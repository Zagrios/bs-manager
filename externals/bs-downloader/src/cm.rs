use crate::proto;
use bytes::Bytes;
use futures_util::{SinkExt, StreamExt};
use prost::Message;
use reqwest_websocket::{Message as WsMessage, Upgrade};
use rsa::rand_core::{OsRng, RngCore};
use serde::Deserialize;
use std::{io::Read, time::Duration};
use tokio::{
    sync::mpsc,
    task::JoinHandle,
    time::{Instant, timeout, timeout_at},
};

const PROTOCOL: u32 = 65_581;
const PROTO_MASK: u32 = 0x8000_0000;
const MAX_PACKET: usize = 32 * 1024 * 1024;
const QUERY_TIMEOUT: Duration = Duration::from_secs(45);
const IO_TIMEOUT: Duration = Duration::from_secs(15);
const MULTI: u32 = 1;
const SERVICE_RESPONSE: u32 = 147;
const SERVICE_REQUEST: u32 = 151;
const HEARTBEAT: u32 = 703;
const LOGON_RESPONSE: u32 = 751;
const LOGGED_OFF: u32 = 757;
const LICENSE_LIST: u32 = 780;
const DEPOT_KEY_REQUEST: u32 = 5438;
const DEPOT_KEY_RESPONSE: u32 = 5439;
const LOGON: u32 = 5514;
const HELLO: u32 = 9805;

#[derive(Debug, thiserror::Error)]
pub enum CmError {
    #[error("backend.steam.cm.disconnected")]
    Disconnected,
    #[error("backend.steam.cm.timeout")]
    Timeout,
    #[error("{}", crate::message::format("backend.steam.cm.rejected", &[.action.to_string(), .result.to_string()]))]
    Rejected { action: &'static str, result: i32 },
    #[error("{}", crate::message::format("backend.steam.cm.protocol", std::slice::from_ref(.0)))]
    Protocol(String),
    #[error("backend.steam.cm.noContentServer")]
    NoContentServer,
    #[error("{}", crate::message::format("backend.steam.cm.directory", &[.0.to_string()]))]
    Directory(#[from] reqwest::Error),
}

impl From<prost::DecodeError> for CmError {
    fn from(_: prost::DecodeError) -> Self {
        Self::Protocol("backend.steam.cm.unreadableProtobuf".into())
    }
}
#[derive(Clone, Debug)]
pub struct ContentServer {
    pub host: String,
    pub vhost: String,
    pub allowed_app_ids: Vec<u32>,
}

struct Packet {
    kind: u32,
    header: proto::Header,
    body: Bytes,
}

enum Command {
    Send(Vec<u8>),
    Session {
        steam_id: u64,
        session_id: i32,
        heartbeat_seconds: u64,
    },
}

pub struct SteamConnection {
    outgoing: mpsc::Sender<Command>,
    incoming: mpsc::Receiver<Result<Packet, CmError>>,
    worker: JoinHandle<()>,
    steam_id: u64,
    session_id: i32,
    cell_id: u32,
    next_job: u64,
    logged_on: bool,
}

impl Drop for SteamConnection {
    fn drop(&mut self) {
        self.worker.abort();
    }
}

#[derive(Deserialize)]
struct DirectoryEnvelope {
    response: DirectoryResponse,
}

#[derive(Deserialize)]
struct DirectoryResponse {
    success: bool,
    serverlist: Vec<DirectoryServer>,
}

#[derive(Deserialize)]
struct DirectoryServer {
    endpoint: String,
    #[serde(rename = "type")]
    kind: String,
}

impl SteamConnection {
    pub async fn connect(client: reqwest::Client) -> Result<Self, CmError> {
        let response = client
            .get("https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/")
            .query(&[("cellid", "0"), ("cmtype", "websockets"), ("maxcount", "8")])
            .timeout(IO_TIMEOUT)
            .send()
            .await?
            .error_for_status()?;
        let bytes = crate::network::read_bounded(response, 1024 * 1024)
            .await
            .map_err(|_| CmError::Disconnected)?;
        let directory: DirectoryEnvelope = serde_json::from_slice(&bytes)
            .map_err(|_| CmError::Protocol("invalidDirectory".into()))?;
        if !directory.response.success {
            return Err(CmError::Protocol(
                "backend.steam.cm.directoryUnavailable".into(),
            ));
        }
        for server in directory
            .response
            .serverlist
            .into_iter()
            .filter(|server| server.kind == "websockets")
            .take(8)
        {
            let Some(url) = cm_url(&server.endpoint) else {
                continue;
            };
            let connected = timeout(IO_TIMEOUT, async {
                client
                    .get(url)
                    .upgrade()
                    .web_socket_config(
                        tungstenite::protocol::WebSocketConfig::default()
                            .max_message_size(Some(MAX_PACKET))
                            .max_frame_size(Some(MAX_PACKET)),
                    )
                    .send()
                    .await?
                    .into_websocket()
                    .await
            })
            .await;
            let Ok(Ok(socket)) = connected else {
                continue;
            };
            let (outgoing, commands) = mpsc::channel(32);
            let (incoming_tx, incoming) = mpsc::channel(128);

            let worker = tokio::spawn(async move {
                let result = connection_worker(socket, commands, &incoming_tx).await;
                if let Err(error) = result {
                    let _ = incoming_tx.try_send(Err(error));
                }
            });
            let mut connection = Self {
                outgoing,
                incoming,
                worker,
                steam_id: 0,
                session_id: 0,
                cell_id: 0,
                next_job: 1,
                logged_on: false,
            };
            connection
                .send(
                    HELLO,
                    &proto::Hello {
                        protocol_version: PROTOCOL,
                    },
                    None,
                )
                .await?;
            return Ok(connection);
        }
        Err(CmError::Disconnected)
    }

    pub async fn log_on(
        &mut self,
        account_name: &str,
        steam_id: u64,
        refresh_token: &str,
    ) -> Result<(), CmError> {
        if self.logged_on || account_name.is_empty() || steam_id == 0 || refresh_token.is_empty() {
            return Err(CmError::Protocol("backend.steam.cm.invalidSession".into()));
        }
        let mut random = [0; 4];
        OsRng
            .try_fill_bytes(&mut random)
            .map_err(|_| CmError::Protocol("backend.steam.cm.invalidSession".into()))?;
        let login_id = u32::from_le_bytes(random).max(1);
        self.steam_id = steam_id;
        self.send(
            LOGON,
            &proto::Logon {
                protocol_version: PROTOCOL,
                deprecated_obfuscated_private_ip: login_id,
                obfuscated_private_ip: Some(proto::LoginAddress { v4: login_id }),
                package_version: 1771,
                language: "english".into(),
                os_type: crate::os_type(),
                remember_password: true,
                account_name: account_name.into(),
                machine_name: "BSManager".into(),
                supports_rate_limit: true,
                access_token: refresh_token.into(),
            },
            None,
        )
        .await?;
        let packet = self.wait_for(LOGON_RESPONSE, None).await?;
        let response = proto::LogonResponse::decode(&packet.body[..])?;
        check_result(response.result, "backend.steam.cm.action.signIn")?;
        let assigned_id = packet
            .header
            .steam_id
            .ok_or_else(|| CmError::Protocol("backend.steam.cm.missingSteamId".into()))?;
        if assigned_id != steam_id {
            return Err(CmError::Protocol(
                "backend.steam.cm.unexpectedSteamId".into(),
            ));
        }
        self.session_id = packet
            .header
            .session_id
            .ok_or_else(|| CmError::Protocol("backend.steam.cm.missingSessionId".into()))?;
        self.cell_id = response.cell_id;
        self.logged_on = true;
        let seconds = if response.out_of_game_heartbeat > 0 {
            response.out_of_game_heartbeat
        } else {
            response.heartbeat
        };
        self.outgoing
            .send(Command::Session {
                steam_id,
                session_id: self.session_id,
                heartbeat_seconds: if seconds > 0 { seconds as u64 } else { 15 },
            })
            .await
            .map_err(|_| CmError::Disconnected)?;
        Ok(())
    }

    pub async fn depot_key(&mut self, depot_id: u32, app_id: u32) -> Result<Vec<u8>, CmError> {
        self.ensure_logged_on()?;
        let job = self
            .send(
                DEPOT_KEY_REQUEST,
                &proto::DepotKeyRequest { depot_id, app_id },
                None,
            )
            .await?;
        let packet = self.wait_for(DEPOT_KEY_RESPONSE, Some(job)).await?;
        let response = proto::DepotKeyResponse::decode(&packet.body[..])?;
        check_result(response.result, "backend.steam.cm.action.depot")?;
        if response.depot_id != depot_id || response.key.len() != 32 {
            return Err(CmError::Protocol("backend.steam.cm.invalidDepotKey".into()));
        }
        Ok(response.key)
    }
    pub async fn manifest_request_code(
        &mut self,
        depot_id: u32,
        app_id: u32,
        manifest_id: u64,
    ) -> Result<u64, CmError> {
        let response: proto::ManifestCodeResponse = self
            .service(
                "ContentServerDirectory.GetManifestRequestCode#1",
                &proto::ManifestCodeRequest {
                    app_id,
                    depot_id,
                    manifest_id,
                },
            )
            .await?;
        if response.code == 0 {
            return Err(CmError::Rejected {
                action: "backend.steam.cm.action.manifest",
                result: 15,
            });
        }
        Ok(response.code)
    }

    pub async fn content_servers(&mut self) -> Result<Vec<ContentServer>, CmError> {
        let mut response: proto::ServerResponse = self
            .service(
                "ContentServerDirectory.GetServersForSteamPipe#1",
                &proto::ServerRequest {
                    cell_id: self.cell_id,
                    max_servers: 30,
                },
            )
            .await?;
        response
            .servers
            .sort_by(|left, right| left.weighted_load.total_cmp(&right.weighted_load));
        let servers: Vec<_> = response
            .servers
            .into_iter()
            .filter(|server| {
                !server.use_as_proxy
                    && matches!(server.server_type.as_str(), "CDN" | "SteamCache")
                    && matches!(server.https_support.as_str(), "mandatory" | "optional")
                    && valid_host(&server.host)
                    && (server.vhost.is_empty() || valid_host(&server.vhost))
            })
            .map(|server| ContentServer {
                vhost: if server.vhost.is_empty() {
                    server.host.clone()
                } else {
                    server.vhost
                },
                host: server.host,
                allowed_app_ids: server.allowed_app_ids,
            })
            .collect();
        if servers.is_empty() {
            Err(CmError::NoContentServer)
        } else {
            Ok(servers)
        }
    }

    pub async fn cdn_auth(
        &mut self,
        app_id: u32,
        depot_id: u32,
        host: &str,
    ) -> Result<String, CmError> {
        if !valid_host(host) {
            return Err(CmError::Protocol("backend.steam.cm.invalidCdnHost".into()));
        }
        let response: proto::CdnAuthResponse = self
            .service(
                "ContentServerDirectory.GetCDNAuthToken#1",
                &proto::CdnAuthRequest {
                    app_id,
                    depot_id,
                    host: host.into(),
                },
            )
            .await?;
        Ok(response.token)
    }

    async fn service<R: Message + Default>(
        &mut self,
        name: &str,
        request: &impl Message,
    ) -> Result<R, CmError> {
        self.ensure_logged_on()?;
        let job = self.send(SERVICE_REQUEST, request, Some(name)).await?;
        let packet = self.wait_for(SERVICE_RESPONSE, Some(job)).await?;
        check_result(
            packet.header.result,
            "backend.steam.cm.action.contentRequest",
        )?;
        R::decode(&packet.body[..]).map_err(Into::into)
    }

    fn ensure_logged_on(&self) -> Result<(), CmError> {
        if self.logged_on {
            Ok(())
        } else {
            Err(CmError::Disconnected)
        }
    }

    async fn send(
        &mut self,
        kind: u32,
        message: &impl Message,
        name: Option<&str>,
    ) -> Result<u64, CmError> {
        let job = self.next_job;
        self.next_job = self
            .next_job
            .checked_add(1)
            .ok_or_else(|| CmError::Protocol("backend.steam.cm.requestIdsExhausted".into()))?;
        let header = proto::Header {
            steam_id: Some(self.steam_id),
            session_id: Some(self.session_id),
            job_source: Some(job),
            target_name: name.map(str::to_owned),
            ..Default::default()
        };
        self.outgoing
            .send(Command::Send(encode(kind, &header, message)))
            .await
            .map_err(|_| CmError::Disconnected)?;
        Ok(job)
    }

    async fn wait_for(&mut self, kind: u32, job: Option<u64>) -> Result<Packet, CmError> {
        let deadline = Instant::now() + QUERY_TIMEOUT;
        loop {
            let packet = timeout_at(deadline, self.incoming.recv())
                .await
                .map_err(|_| CmError::Timeout)?
                .ok_or(CmError::Disconnected)??;
            if packet.kind == LOGGED_OFF {
                self.logged_on = false;
                return Err(CmError::Disconnected);
            }
            if packet.kind == kind && job.is_none_or(|id| packet.header.job_target == Some(id)) {
                if packet
                    .header
                    .transport_error
                    .is_some_and(|error| error != 0 && error != 1)
                {
                    return Err(CmError::Rejected {
                        action: "backend.steam.cm.action.requestTransport",
                        result: packet.header.transport_error.unwrap_or(2),
                    });
                }
                return Ok(packet);
            }
        }
    }
}

fn check_result(result: Option<i32>, action: &'static str) -> Result<(), CmError> {
    let result = result.unwrap_or(2);
    if result == 1 {
        Ok(())
    } else {
        Err(CmError::Rejected { action, result })
    }
}

fn cm_url(endpoint: &str) -> Option<String> {
    let url = reqwest::Url::parse(&format!("wss://{endpoint}/cmsocket/")).ok()?;
    if url.username().is_empty()
        && url.password().is_none()
        && url.query().is_none()
        && url.fragment().is_none()
        && url.path() == "/cmsocket/"
        && url
            .host_str()
            .is_some_and(|host| host.ends_with(".steamserver.net"))
    {
        Some(url.into())
    } else {
        None
    }
}

fn valid_host(host: &str) -> bool {
    !host.is_empty()
        && host.len() <= 253
        && host
            .bytes()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == b'.' || ch == b'-')
}

type Socket = reqwest_websocket::WebSocket;
async fn send_message(socket: &mut Socket, message: WsMessage) -> Result<(), CmError> {
    timeout(IO_TIMEOUT, socket.send(message))
        .await
        .map_err(|_| CmError::Timeout)?
        .map_err(|_| CmError::Disconnected)
}

async fn connection_worker(
    mut socket: Socket,
    mut commands: mpsc::Receiver<Command>,
    incoming: &mpsc::Sender<Result<Packet, CmError>>,
) -> Result<(), CmError> {
    let mut heartbeat_header = None;
    let mut heartbeat = tokio::time::interval(Duration::from_secs(15));
    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut last_received = Instant::now();
    loop {
        tokio::select! {
            command = commands.recv() => match command {
                Some(Command::Send(bytes)) => send_message(&mut socket, WsMessage::Binary(bytes.into())).await?,
                Some(Command::Session { steam_id, session_id, heartbeat_seconds }) => {
                    heartbeat_header = Some(proto::Header { steam_id: Some(steam_id), session_id: Some(session_id), ..Default::default() });
                    heartbeat = tokio::time::interval(Duration::from_secs(heartbeat_seconds.clamp(1, 60)));
                    heartbeat.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
                    last_received = Instant::now();
                }
                None => return Ok(()),
            },
            _ = heartbeat.tick() => {
                if let Some(header) = &heartbeat_header {
                    send_message(&mut socket, WsMessage::Binary(encode(HEARTBEAT, header, &proto::Heartbeat { send_reply: true }).into())).await?;
                }
            },
            _ = tokio::time::sleep_until(last_received + Duration::from_secs(90)), if heartbeat_header.is_some() => return Err(CmError::Disconnected),
            frame = socket.next() => match frame {
                Some(Ok(WsMessage::Binary(bytes))) => {
                    last_received = Instant::now();
                    let mut packets = Vec::new();
                    let mut budget = MAX_PACKET;
                    decode_packets(bytes, 0, &mut budget, &mut packets)?;
                    for packet in packets {
                        if packet.kind == LOGGED_OFF {
                            let _ = incoming.try_send(Ok(packet));
                            return Err(CmError::Disconnected);
                        }
                        if matches!(packet.kind, SERVICE_RESPONSE | LOGON_RESPONSE | DEPOT_KEY_RESPONSE) {
                            incoming.try_send(Ok(packet)).map_err(|_| CmError::Protocol("tooManyPendingResponses".into()))?;
                        }
                    }
                }
                Some(Ok(WsMessage::Ping(data))) => {
                    last_received = Instant::now();
                    send_message(&mut socket, WsMessage::Pong(data)).await?;
                }
                Some(Ok(WsMessage::Close { .. })) | Some(Err(_)) | None => return Err(CmError::Disconnected),
                _ => {},
            }
        }
    }
}

fn encode(kind: u32, header: &proto::Header, message: &impl Message) -> Vec<u8> {
    let header = header.encode_to_vec();
    let mut bytes = Vec::with_capacity(8 + header.len() + message.encoded_len());
    bytes.extend_from_slice(&(kind | PROTO_MASK).to_le_bytes());
    bytes.extend_from_slice(&(header.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&header);
    bytes.extend_from_slice(&message.encode_to_vec());
    bytes
}

fn decode_packets(
    bytes: Bytes,
    depth: usize,
    budget: &mut usize,
    output: &mut Vec<Packet>,
) -> Result<(), CmError> {
    if depth > 8 || bytes.len() > *budget || output.len() >= 2048 {
        return Err(CmError::Protocol("backend.steam.cm.invalidEnvelope".into()));
    }
    let Some((wire_kind, rest)) = bytes.split_first_chunk::<4>() else {
        return Err(CmError::Protocol("backend.steam.cm.missingType".into()));
    };
    let Some((header_size, _)) = rest.split_first_chunk::<4>() else {
        return Err(CmError::Protocol("backend.steam.cm.missingHeader".into()));
    };
    *budget -= bytes.len();
    let wire_kind = u32::from_le_bytes(*wire_kind);
    if wire_kind & PROTO_MASK == 0 {
        return decode_legacy_packet(wire_kind, &bytes, output);
    }
    let header_size = u32::from_le_bytes(*header_size) as usize;
    let Some(header_end) = header_size.checked_add(8).filter(|end| *end <= bytes.len()) else {
        return Err(CmError::Protocol("backend.steam.cm.truncatedHeader".into()));
    };
    let header = proto::Header::decode(&bytes[8..header_end])?;
    let kind = wire_kind & !PROTO_MASK;
    let body = bytes.slice(header_end..);
    if kind != MULTI {
        output.push(Packet { kind, header, body });
        return Ok(());
    }
    let multi = proto::Multi::decode(body)?;
    let body = if multi.size_unzipped == 0 {
        multi.body
    } else {
        let size = multi.size_unzipped as usize;
        if size > *budget {
            return Err(CmError::Protocol("backend.steam.cm.gzipTooLarge".into()));
        }
        let mut decompressed = Vec::with_capacity(size);
        flate2::read::GzDecoder::new(&multi.body[..])
            .take(size as u64 + 1)
            .read_to_end(&mut decompressed)
            .map_err(|_| CmError::Protocol("backend.steam.cm.unreadableGzip".into()))?;
        if decompressed.len() != size {
            return Err(CmError::Protocol("backend.steam.cm.invalidGzipSize".into()));
        }
        Bytes::from(decompressed)
    };
    let mut offset = 0;
    while offset < body.len() {
        let Some((length, _)) = body[offset..].split_first_chunk::<4>() else {
            return Err(CmError::Protocol(
                "backend.steam.cm.truncatedSubmessage".into(),
            ));
        };
        let start = offset + 4;
        let Some(end) = start
            .checked_add(u32::from_le_bytes(*length) as usize)
            .filter(|end| *end <= body.len())
        else {
            return Err(CmError::Protocol(
                "backend.steam.cm.truncatedSubmessage".into(),
            ));
        };
        decode_packets(body.slice(start..end), depth + 1, budget, output)?;
        offset = end;
    }
    Ok(())
}
fn decode_legacy_packet(kind: u32, bytes: &[u8], output: &mut Vec<Packet>) -> Result<(), CmError> {
    if matches!(kind, 1303..=1305) {
        return if bytes.len() >= 20 {
            Ok(())
        } else {
            Err(CmError::Protocol(crate::message::format(
                "backend.steam.cm.truncatedLegacyHeader",
                &[kind.to_string()],
            )))
        };
    }
    if bytes.len() < 36 || bytes[4] != 36 || bytes[5..7] != 2_u16.to_le_bytes() || bytes[23] != 239
    {
        return Err(CmError::Protocol(crate::message::format(
            "backend.steam.cm.invalidLegacyHeader",
            &[kind.to_string()],
        )));
    }
    if kind == LOGON_RESPONSE {
        let result = bytes
            .get(36..40)
            .and_then(|bytes| bytes.try_into().ok())
            .map(i32::from_le_bytes)
            .ok_or_else(|| CmError::Protocol("backend.steam.cm.truncatedLegacyLogon".into()))?;
        check_result(Some(result), "backend.steam.cm.action.signIn")?;
        return Err(CmError::Protocol(
            "backend.steam.cm.unsupportedLegacyLogon".into(),
        ));
    }
    if kind == LOGGED_OFF {
        let result = bytes
            .get(36..40)
            .and_then(|body| body.try_into().ok())
            .map(i32::from_le_bytes);
        output.push(Packet {
            kind,
            header: proto::Header::default(),
            body: proto::LoggedOff { result }.encode_to_vec().into(),
        });
        return Ok(());
    }
    if matches!(
        kind,
        MULTI | SERVICE_RESPONSE | LICENSE_LIST | DEPOT_KEY_RESPONSE
    ) {
        return Err(CmError::Protocol(crate::message::format(
            "backend.steam.cm.expectedProtobuf",
            &[kind.to_string()],
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn websocket_endpoints_cannot_redirect_tokens_to_other_hosts() {
        assert!(cm_url("cmp1-fra1.steamserver.net:443").is_some());
        for host in [
            "evil.example",
            "steamserver.net.evil.example",
            "user@cmp1-fra1.steamserver.net",
            "cmp1-fra1.steamserver.net/other",
            "cmp1-fra1.steamserver.net?secret=1",
        ] {
            assert!(cm_url(host).is_none(), "{host}");
        }
    }

    #[test]
    fn packets_keep_64_bit_job_and_account_ids_and_reject_truncation() {
        let header = proto::Header {
            steam_id: Some(76561198000000000),
            session_id: Some(123),
            job_target: Some(u64::MAX - 1),
            ..Default::default()
        };
        let bytes = encode(
            HELLO,
            &header,
            &proto::Hello {
                protocol_version: PROTOCOL,
            },
        );
        let mut packets = Vec::new();
        decode_packets(
            bytes.clone().into(),
            0,
            &mut MAX_PACKET.clone(),
            &mut packets,
        )
        .unwrap();
        assert_eq!(packets[0].header, header);
        assert_eq!(
            proto::Hello::decode(packets[0].body.clone())
                .unwrap()
                .protocol_version,
            PROTOCOL
        );
        for length in 0..8 {
            assert!(
                decode_packets(
                    bytes[..length].to_vec().into(),
                    0,
                    &mut MAX_PACKET.clone(),
                    &mut Vec::new()
                )
                .is_err()
            );
        }
    }

    #[tokio::test]
    #[ignore = "Contacts Steam anonymously; no account, password or game files"]
    async fn live_anonymous_connection_and_regional_cdn_discovery() {
        let mut connection = SteamConnection::connect(crate::network::client().unwrap())
            .await
            .unwrap();
        connection.steam_id = (1_u64 << 56) | (10_u64 << 52);
        connection
            .send(
                LOGON,
                &proto::Logon {
                    protocol_version: PROTOCOL,
                    language: "english".into(),
                    os_type: crate::os_type(),
                    ..Default::default()
                },
                None,
            )
            .await
            .unwrap();
        let packet = connection.wait_for(LOGON_RESPONSE, None).await.unwrap();
        let response = proto::LogonResponse::decode(packet.body).unwrap();
        check_result(response.result, "anonymous sign-in").unwrap();
        connection.steam_id = packet.header.steam_id.unwrap();
        connection.session_id = packet.header.session_id.unwrap();
        connection.cell_id = response.cell_id;
        connection.logged_on = true;
        let servers = connection.content_servers().await.unwrap();
        assert!(!servers.is_empty());
        assert_eq!(connection.depot_key(1004, 1007).await.unwrap().len(), 32);
    }
}
