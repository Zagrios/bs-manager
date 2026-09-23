use std::{
    io::{Read, Write},
    net::TcpListener,
    thread,
};

use rsa::{RsaPrivateKey, traits::PublicKeyParts};

use super::*;

const TEST_STEAM_ID: u64 = 76_561_197_960_265_729;

fn token(steam_id: u64) -> String {
    let claims = format!(r#"{{"sub":"{steam_id}","aud":["client"]}}"#);
    format!(
        "e30.{}.test-signature",
        general_purpose::URL_SAFE_NO_PAD.encode(claims)
    )
}

fn confirmations() -> Vec<wire::Confirmation> {
    vec![
        wire::Confirmation { kind: 4 },
        wire::Confirmation { kind: 3 },
    ]
}

fn session() -> AuthSession {
    make_session(10, vec![1, 2, 3], None, None, confirmations(), 5.0).unwrap()
}

#[test]
fn guard_steam_id_uses_fixed64_wire_encoding() {
    let input = wire::GuardRequest {
        client_id: 150,
        steam_id: TEST_STEAM_ID,
        code: "ABCDE".into(),
        kind: 3,
    };
    assert_eq!(
        input.encode_to_vec(),
        [
            0x08, 0x96, 0x01, 0x11, 0x01, 0x00, 0x00, 0x00, 0x01, 0x00, 0x10, 0x01, 0x1a, 0x05,
            b'A', b'B', b'C', b'D', b'E', 0x20, 0x03,
        ]
    );
}

#[test]
fn tokens_are_routed_only_to_the_authenticated_steam_id() {
    let mut session = session();
    session.steam_id = Some(TEST_STEAM_ID);
    let response = wire::PollResponse {
        account_name: "fixture-user".into(),
        refresh_token: token(TEST_STEAM_ID + 1),
        ..Default::default()
    };
    assert!(matches!(
        apply_poll_response(&mut session, response),
        Err(AuthError::Protocol)
    ));
    assert!(!session.completed);

    let response = wire::PollResponse {
        account_name: "fixture-user".into(),
        refresh_token: token(TEST_STEAM_ID),
        ..Default::default()
    };
    let tokens = apply_poll_response(&mut session, response)
        .unwrap()
        .unwrap();
    assert_eq!(tokens.steam_id, TEST_STEAM_ID);
    assert!(session.completed);
    assert_eq!(session.request_id, [0, 0, 0]);
    assert!(session.challenge_url().is_none());
}

#[test]
fn polling_rotates_qr() {
    let mut session = session();
    let response = wire::PollResponse {
        new_client_id: 20,
        new_challenge_url: "https://s.team/q/1/20".into(),
        ..Default::default()
    };
    assert!(
        apply_poll_response(&mut session, response)
            .unwrap()
            .is_none()
    );
    assert_eq!(session.client_id, 20);
    assert_eq!(session.challenge_url(), Some("https://s.team/q/1/20"));
    apply_poll_response(&mut session, wire::PollResponse::default()).unwrap();
    assert_eq!(session.challenge_url(), Some("https://s.team/q/1/20"));
}

#[test]
fn invalid_sessions_and_untrusted_qr_targets_are_rejected() {
    for interval in [0.0, -1.0, f32::NAN, f32::INFINITY, 301.0] {
        assert!(make_session(1, vec![1], None, None, confirmations(), interval).is_err());
    }
    assert!(make_session(0, vec![1], None, None, confirmations(), 5.0).is_err());
    assert!(make_session(1, vec![], None, None, confirmations(), 5.0).is_err());
    for url in [
        "http://s.team/q/1/2",
        "https://s.team.attacker.invalid/q/1/2",
        "https://attacker.invalid/q/1/2",
        "https://user@s.team/q/1/2",
        "https://s.team:444/q/1/2",
        "file:///q/1/2",
        "https://s.team/different-path",
    ] {
        assert!(validate_challenge_url(url.into()).is_err());
    }
    assert!(validate_challenge_url("https://s.team/q/1/2".into()).is_ok());
}

#[test]
fn error_mapping_preserves_retry_and_expiration_semantics() {
    assert_eq!(check_result(65, false), Err(AuthError::GuardRejected));
    assert_eq!(check_result(88, false), Err(AuthError::GuardRejected));
    assert_eq!(check_result(5, false), Err(AuthError::CredentialsRejected));
    assert_eq!(check_result(27, false), Err(AuthError::Expired));
    assert_eq!(check_result(84, false), Err(AuthError::RateLimited));
    assert_eq!(check_result(29, true), Ok(()));
    assert_eq!(
        check_result(29, false),
        Err(AuthError::Steam { result: 29 })
    );
}

#[test]
fn malformed_or_non_user_jwt_subjects_are_rejected() {
    assert_eq!(
        steam_id_from_refresh_token(&token(TEST_STEAM_ID)),
        Ok(TEST_STEAM_ID)
    );
    for token in [
        String::new(),
        "first.second.third.fourth".into(),
        "first.invalid-base64.third".into(),
        token(0),
        token(u64::MAX),
        token(76_561_197_960_265_728),
    ] {
        assert!(steam_id_from_refresh_token(&token).is_err());
    }
}

struct Reply {
    result: Option<i32>,
    body: Vec<u8>,
    advertised_length: Option<usize>,
}

impl Reply {
    fn protobuf(value: impl Message) -> Self {
        Self {
            result: Some(1),
            body: value.encode_to_vec(),
            advertised_length: None,
        }
    }
}

struct CapturedRequest {
    first_line: String,
    payload: Vec<u8>,
}

fn test_server(replies: Vec<Reply>) -> (AuthClient, thread::JoinHandle<Vec<CapturedRequest>>) {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    let handle = thread::spawn(move || {
        replies
            .into_iter()
            .map(|reply| {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(5)))
                    .unwrap();
                let mut request = Vec::new();
                let mut byte = [0];
                while !request.ends_with(b"\r\n\r\n") {
                    stream.read_exact(&mut byte).unwrap();
                    request.push(byte[0]);
                    assert!(request.len() < 65_536);
                }
                let headers = String::from_utf8(request).unwrap();
                let first_line = headers.lines().next().unwrap().to_owned();
                let length = headers
                    .lines()
                    .find_map(|line| {
                        let (key, value) = line.split_once(':')?;
                        key.eq_ignore_ascii_case("content-length")
                            .then(|| value.trim().parse::<usize>().unwrap())
                    })
                    .unwrap_or(0);
                let mut body = vec![0; length];
                stream.read_exact(&mut body).unwrap();
                let form = if first_line.starts_with("GET ") {
                    first_line.split_whitespace().nth(1).unwrap().to_owned()
                } else {
                    format!("/?{}", String::from_utf8(body).unwrap())
                };
                let url = reqwest::Url::parse(&format!("http://localhost{form}")).unwrap();
                let fields: std::collections::HashMap<_, _> = url.query_pairs().collect();
                assert_eq!(fields.get("format").unwrap(), "protobuf_raw");
                let payload = general_purpose::STANDARD
                    .decode(fields.get("input_protobuf_encoded").unwrap().as_bytes())
                    .unwrap();
                let mut headers = format!(
                    "HTTP/1.1 200 OK\r\nConnection: close\r\nContent-Length: {}\r\n",
                    reply.advertised_length.unwrap_or(reply.body.len()),
                );
                if let Some(result) = reply.result {
                    headers.push_str(&format!("x-eresult: {result}\r\n"));
                }
                headers.push_str("\r\n");
                stream.write_all(headers.as_bytes()).unwrap();
                stream.write_all(&reply.body).unwrap();
                CapturedRequest {
                    first_line,
                    payload,
                }
            })
            .collect()
    });
    let client = AuthClient {
        http: Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .unwrap(),
        endpoint: format!("http://{address}/IAuthenticationService"),
    };
    (client, handle)
}

#[tokio::test]
async fn qr_login_does_not_prompt_for_guard_before_scan() {
    use crate::{
        protocol::{Command, Options},
        runner::authenticate_with_client,
    };
    let (client, server) = test_server(vec![Reply::protobuf(wire::BeginQrResponse {
        client_id: 10,
        challenge_url: "https://s.team/q/1/10".into(),
        request_id: vec![1, 2, 3],
        interval: 5.0,
        confirmations: confirmations(),
    })]);
    let mut options: Options = serde_json::from_value(serde_json::json!({
        "app": 620980, "depot": 620981, "manifest": "1",
        "directory": std::env::temp_dir(), "qr": true,
    }))
    .unwrap();
    let (tx, mut input) = tokio::sync::mpsc::channel(1);
    tx.send(Command::Cancel).await.unwrap();
    let mut events = Vec::new();
    let result = authenticate_with_client(&mut options, &client, &mut input, |subtype, _| {
        events.push(subtype.to_owned());
    })
    .await;
    assert!(matches!(result, Err("NotCompleted")));
    assert_eq!(server.join().unwrap().len(), 1);
    assert_eq!(
        events,
        ["QRCode"],
        "Opening QR login must not open a Steam Guard or mobile approval modal"
    );
}

#[tokio::test]
async fn credential_login_still_prompts_for_steam_guard() {
    use crate::{
        protocol::{Command, Options},
        runner::authenticate_with_client,
    };

    let key = RsaPrivateKey::new(&mut OsRng, 2048)
        .unwrap()
        .to_public_key();
    for (kinds, expected) in [
        (vec![2], "Guard"),
        (vec![3], "2FA"),
        (vec![4], "MobileApp"),
        (vec![4, 3], "MobileApp"),
        (vec![3, 4], "MobileApp"),
    ] {
        let (client, server) = test_server(vec![
            Reply::protobuf(wire::PasswordKeyResponse {
                modulus: key.n().to_str_radix(16),
                exponent: key.e().to_str_radix(16),
                timestamp: 123_456,
            }),
            Reply::protobuf(wire::BeginCredentialsResponse {
                client_id: 99,
                request_id: vec![1, 2, 3],
                steam_id: TEST_STEAM_ID,
                interval: 5.0,
                confirmations: kinds
                    .into_iter()
                    .map(|kind| wire::Confirmation { kind })
                    .collect(),
                ..Default::default()
            }),
        ]);
        let mut options: Options = serde_json::from_value(serde_json::json!({
            "app": 620980, "depot": 620981, "manifest": "1",
            "directory": std::env::temp_dir(), "username": "fixture-user", "password": "fixture-password",
        })).unwrap();
        let (tx, mut input) = tokio::sync::mpsc::channel(1);
        tx.send(Command::Cancel).await.unwrap();
        let mut events = Vec::new();
        let result = authenticate_with_client(&mut options, &client, &mut input, |subtype, _| {
            events.push(subtype.to_owned());
        })
        .await;
        assert!(matches!(result, Err("NotCompleted")));
        assert_eq!(server.join().unwrap().len(), 2);
        assert_eq!(events, [expected]);
    }
}

#[tokio::test]
async fn credentials_encrypt_password_then_handle_guard_retry_and_completion() {
    let private_key = RsaPrivateKey::new(&mut OsRng, 2048).unwrap();
    let key = private_key.to_public_key();
    let replies = vec![
        Reply::protobuf(wire::PasswordKeyResponse {
            modulus: key.n().to_str_radix(16),
            exponent: key.e().to_str_radix(16),
            timestamp: 123_456,
        }),
        Reply::protobuf(wire::BeginCredentialsResponse {
            client_id: 99,
            request_id: vec![1, 2, 3],
            steam_id: TEST_STEAM_ID,
            interval: 5.0,
            confirmations: confirmations(),
            ..Default::default()
        }),
        Reply {
            result: Some(88),
            body: vec![],
            advertised_length: None,
        },
        Reply {
            result: Some(29),
            body: vec![],
            advertised_length: None,
        },
        Reply::protobuf(wire::PollResponse {
            account_name: "fixture-user".into(),
            refresh_token: token(TEST_STEAM_ID),
            ..Default::default()
        }),
    ];
    let (client, server) = test_server(replies);
    let mut session = client
        .begin_credentials(" fixture-user ", " test password ")
        .await
        .unwrap();
    assert_eq!(
        client
            .submit_guard(&session, "aaaaa", GuardType::DeviceCode)
            .await,
        Err(AuthError::GuardRejected)
    );
    client
        .submit_guard(&session, "bbbbb", GuardType::DeviceCode)
        .await
        .unwrap();
    let tokens = client.poll(&mut session).await.unwrap().unwrap();
    assert_eq!(tokens.steam_id, TEST_STEAM_ID);
    assert_eq!(tokens.account_name, "fixture-user");
    assert!(matches!(
        client.poll(&mut session).await,
        Err(AuthError::Expired)
    ));

    let requests = server.join().unwrap();
    assert!(
        requests[0]
            .first_line
            .starts_with("GET /IAuthenticationService/GetPasswordRSAPublicKey/v1/")
    );
    let key_request = wire::PasswordKeyRequest::decode(requests[0].payload.as_slice()).unwrap();
    assert_eq!(key_request.account_name, "fixture-user");
    assert!(
        requests[1]
            .first_line
            .starts_with("POST /IAuthenticationService/BeginAuthSessionViaCredentials/v1/")
    );
    let credentials =
        wire::BeginCredentialsRequest::decode(requests[1].payload.as_slice()).unwrap();
    assert_eq!(credentials.encryption_timestamp, 123_456);
    assert_eq!(credentials.device.unwrap().platform, 1);
    let encrypted = general_purpose::STANDARD
        .decode(credentials.encrypted_password)
        .unwrap();
    assert_eq!(
        private_key.decrypt(Pkcs1v15Encrypt, &encrypted).unwrap(),
        b" test password "
    );
    let guard = wire::GuardRequest::decode(requests[3].payload.as_slice()).unwrap();
    assert_eq!(guard.code, "BBBBB");
    assert_eq!(guard.steam_id, TEST_STEAM_ID);
}

#[tokio::test]
async fn http_missing_result_and_oversized_response_are_rejected() {
    let (client, server) = test_server(vec![
        Reply {
            result: None,
            body: vec![],
            advertised_length: None,
        },
        Reply {
            result: Some(1),
            body: vec![],
            advertised_length: Some(MAX_RESPONSE_BYTES + 1),
        },
    ]);
    assert!(matches!(client.begin_qr().await, Err(AuthError::Protocol)));
    assert!(matches!(client.begin_qr().await, Err(AuthError::Protocol)));
    server.join().unwrap();
}

#[tokio::test]
#[ignore = "Contacts Steam to create an unauthenticated QR request; no account or password required"]
async fn live_qr_handshake_and_pending_poll() {
    let http = crate::network::client().unwrap();
    let client = AuthClient::new(http);
    let mut session = client.begin_qr().await.unwrap();
    assert!(session.challenge_url().is_some());
    assert!(!session.allowed_confirmations().is_empty());
    tokio::time::sleep(session.polling_interval()).await;
    assert!(client.poll(&mut session).await.unwrap().is_none());
}
