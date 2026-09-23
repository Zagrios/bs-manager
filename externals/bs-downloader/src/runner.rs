use crate::{
    auth::{AuthClient, AuthError, AuthTokens, GuardType},
    cm::{CmError, SteamConnection},
    content::{ContentClient, ContentError, DepotDownload},
    protocol::{Command, Options, emit},
    transfer::{CancelToken, DownloadPhase},
};
use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tokio::sync::mpsc;

type Result<T> = std::result::Result<T, &'static str>;

pub async fn run(
    mut options: Options,
    input: &mut mpsc::Receiver<Command>,
    cancel: &CancelToken,
) -> Result<()> {
    let manifest = options.manifest_id()?;
    let http = crate::network::client().map_err(|_| "ConnectionError")?;
    emit("Diagnostic", "Authentication", "");
    let tokens = authenticate(&mut options, http.clone(), input).await?;
    options.password.clear();
    let content = ContentClient::new(http.clone());
    let mut last_error = "ConnectionError";
    let mut announced = false;
    let progress = Arc::new(Mutex::new(ProgressDisplay::default()));
    for round in 0..3 {
        if round > 0 {
            tokio::time::sleep(Duration::from_secs(1 << round)).await;
        }
        emit("Diagnostic", "SteamConnection", round + 1);
        let result = async {
            let mut cm = SteamConnection::connect(http.clone()).await.map_err(cm_error)?;
            cm.log_on(&tokens.account_name, tokens.steam_id, &tokens.refresh_token).await.map_err(cm_error)?;
            if !announced {
                emit("Session", "Authenticated", serde_json::json!({ "username": tokens.account_name, "refreshToken": tokens.refresh_token }));
                emit("Info", "SteamID", tokens.steam_id.to_string());
                announced = true;
            }
            emit("Diagnostic", "DepotAuthorization", "");
            let key: [u8; 32] = cm.depot_key(options.depot, options.app).await.map_err(cm_error)?
                .try_into().map_err(|_| "NoValidKey")?;
            let servers = cm.content_servers().await.map_err(cm_error)?;
            let mut eligible = servers.into_iter().filter(|server| server.allowed_app_ids.is_empty() || server.allowed_app_ids.contains(&options.app)).peekable();
            if eligible.peek().is_none() { return Err("NoServer"); }
            let mut last = "NoServer";
            for (index, server) in eligible.take(12).enumerate() {
                emit("Diagnostic", "CDN", serde_json::json!({"host": server.vhost, "attempt": index + 1, "round": round + 1}));
                let cached = content.cached_manifest(&options.directory, options.depot, manifest, &key).await.map_err(content_error)?;
                let code = if cached.is_some() { 0 } else {
                    emit("Diagnostic", "ManifestAuthorization", "");
                    cm.manifest_request_code(options.depot, options.app, manifest).await.map_err(cm_error)?
                };
                let mut plan = DepotDownload { depot_id: options.depot, manifest_id: manifest, request_code: code,
                    depot_key: key, server: server.vhost, cdn_token: None, destination: options.directory.clone(), cached_manifest: cached };
                let mut result = download(&content, &plan, cancel, &progress).await;
                if matches!(result, Err(ContentError::Http(401 | 403))) {
                    emit("Diagnostic", "CDNAuthorization", "");
                    match cm.cdn_auth(options.app, options.depot, &server.host).await {
                        Ok(token) => {
                            plan.cdn_token = Some(token);
                            result = download(&content, &plan, cancel, &progress).await;
                        }
                        Err(error) => {
                            let code = cm_error(error);
                            if !retryable(code) { return Err(code); }
                            last = code;
                            continue;
                        }
                    }
                }
                match result {
                    Ok(()) => return Ok(()),
                    Err(error @ (ContentError::Network | ContentError::Http(_) | ContentError::InvalidData(_))) => {
                        last = content_error(error);
                        emit("Diagnostic", "CDNRetry", last);
                    }
                    Err(error) => return Err(content_error(error)),
                }
            }
            Err(last)
        }.await;
        match result {
            Ok(()) => {
                emit("Info", "Progress", "100");
                emit("Info", "Finished", "");
                return Ok(());
            }
            Err(code) if retryable(code) => last_error = code,
            Err(code) => return Err(code),
        }
    }
    Err(last_error)
}

async fn download(
    content: &ContentClient,
    plan: &DepotDownload,
    cancel: &CancelToken,
    progress: &Arc<Mutex<ProgressDisplay>>,
) -> std::result::Result<(), ContentError> {
    let display = Arc::clone(progress);
    content
        .download_depot(plan, cancel, move |progress| {
            let subtype = if progress.phase == DownloadPhase::Verifying {
                "Validated"
            } else {
                "Progress"
            };
            let mut display = display
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner);
            let bytes = if progress.phase == DownloadPhase::Verifying {
                progress
                    .verification_bytes
                    .unwrap_or(progress.completed_bytes)
            } else {
                progress.completed_bytes
            };
            let percent = if progress.total_bytes == 0 {
                0.0
            } else {
                (bytes as f64 / progress.total_bytes as f64 * 100.0).clamp(0.0, 100.0)
            };
            if let Some(percent) = display.update(subtype, percent) {
                emit("Info", subtype, format!("{percent:.2}"));
            }
        })
        .await
        .map(|_| ())
}

struct ProgressDisplay {
    last: Instant,
    subtype: &'static str,
    downloaded: f64,
    verified: f64,
}

impl Default for ProgressDisplay {
    fn default() -> Self {
        Self {
            last: Instant::now() - Duration::from_secs(1),
            subtype: "",
            downloaded: 0.0,
            verified: 0.0,
        }
    }
}

impl ProgressDisplay {
    fn update(&mut self, subtype: &'static str, percent: f64) -> Option<f64> {
        let previous = if subtype == "Validated" {
            &mut self.verified
        } else {
            &mut self.downloaded
        };
        if percent < *previous
            || (self.last.elapsed() < Duration::from_millis(100)
                && self.subtype == subtype
                && percent < 100.0)
        {
            return None;
        }
        *previous = percent;
        self.last = Instant::now();
        self.subtype = subtype;
        Some(percent)
    }
}

async fn authenticate(
    options: &mut Options,
    http: reqwest::Client,
    input: &mut mpsc::Receiver<Command>,
) -> Result<AuthTokens> {
    authenticate_with_client(options, &AuthClient::new(http), input, |subtype, data| {
        emit("Info", subtype, data);
    })
    .await
}

pub(crate) async fn authenticate_with_client(
    options: &mut Options,
    client: &AuthClient,
    input: &mut mpsc::Receiver<Command>,
    mut notify: impl FnMut(&str, &str),
) -> Result<AuthTokens> {
    if let Some(token) = options.refresh_token.take() {
        return AuthTokens::restore(options.username.clone(), token).map_err(|_| "TokenRejected");
    }
    let mut session = if options.qr {
        client.begin_qr().await
    } else {
        if options.password.is_empty() {
            notify("Password", "");
            return Err("InvalidCredentials");
        }
        client
            .begin_credentials(&options.username, &options.password)
            .await
    }
    .map_err(auth_error)?;
    options.password.clear();
    let mut challenge = session.challenge_url().map(str::to_owned);
    if let Some(url) = &challenge {
        notify("QRCode", url);
    }
    let confirmations = session.allowed_confirmations();
    let mobile_approval = !options.qr
        && confirmations.iter().any(|item| {
            matches!(
                item,
                GuardType::DeviceConfirmation | GuardType::EmailConfirmation
            )
        });
    let code_kind = confirmations
        .iter()
        .filter(|_| !options.qr && !mobile_approval)
        .find_map(|confirmation| match *confirmation {
            kind @ (GuardType::DeviceCode | GuardType::EmailCode) => Some(kind),
            _ => None,
        });
    if let Some(kind) = code_kind {
        notify(
            if kind == GuardType::EmailCode {
                "Guard"
            } else {
                "2FA"
            },
            "",
        );
    } else if mobile_approval {
        notify("MobileApp", "");
    } else if !options.qr && !confirmations.contains(&GuardType::None) {
        return Err("NotAllowed");
    }
    let expires = tokio::time::Instant::now() + Duration::from_secs(300);
    let mut next_poll = tokio::time::Instant::now() + session.polling_interval();
    let mut failures = 0;
    loop {
        tokio::select! {
            _ = tokio::time::sleep_until(expires) => return Err("ConnectionTimeout"),
            command = input.recv() => match command {
                Some(Command::Input { value }) => {
                    let kind = code_kind.ok_or("NotAllowed")?;
                    client.submit_guard(&session, &value, kind).await.map_err(auth_error)?;
                }
                _ => return Err("NotCompleted"),
            },
            _ = tokio::time::sleep_until(next_poll) => {
                match client.poll(&mut session).await {
                    Ok(Some(tokens)) => return Ok(tokens),
                    Ok(None) => failures = 0,
                    Err(AuthError::Network | AuthError::Http { status: 500..=599 }) if failures < 3 => failures += 1,
                    Err(error) => return Err(auth_error(error)),
                }
                if session.challenge_url() != challenge.as_deref() {
                    challenge = session.challenge_url().map(str::to_owned);
                    if let Some(url) = &challenge { notify("QRCode", url); }
                }
                next_poll = tokio::time::Instant::now() + session.polling_interval().max(Duration::from_secs(1 << failures));
            }
        }
    }
}

fn auth_error(error: AuthError) -> &'static str {
    match error {
        AuthError::CredentialsRejected
        | AuthError::InvalidCredentialsInput
        | AuthError::GuardRejected => "InvalidCredentials",
        AuthError::Expired => "TokenRejected",
        AuthError::Network | AuthError::Http { .. } => "ConnectionError",
        AuthError::RateLimited => "ConnectionTimeout",
        _ => "NotAllowed",
    }
}

fn cm_error(error: CmError) -> &'static str {
    match error {
        CmError::Timeout => "ConnectionTimeout",
        CmError::Disconnected | CmError::Directory(_) => "ConnectionError",
        CmError::NoContentServer => "NoServer",
        CmError::Rejected {
            result: 5 | 63 | 65 | 85 | 88,
            ..
        } => "TokenRejected",
        CmError::Rejected { action, .. } if action.ends_with("manifest") => "NoManifestCode",
        CmError::Rejected { result: 15, .. } => "AccessDenied",
        CmError::Rejected {
            result: 9 | 16 | 20 | 25 | 84,
            ..
        } => "ConnectionError",
        CmError::Rejected { .. } => "NotAllowed",
        CmError::Protocol(_) => "SteamLib",
    }
}

fn content_error(error: ContentError) -> &'static str {
    if let ContentError::InvalidData(reason) = &error {
        emit("Diagnostic", "ContentFailure", reason);
    }
    match error {
        ContentError::Network => "ConnectionError",
        ContentError::Http(401) => "401",
        ContentError::Http(403) => "AccessDenied",
        ContentError::Http(404) => "404",
        ContentError::Http(_) => "ConnectionError",
        ContentError::InvalidData(_)
        | ContentError::UnsafePath(_)
        | ContentError::UnsupportedSymlink(_) => "InvalidManifest",
        ContentError::Io(_) => "DirectoryCreate",
        ContentError::Cancelled | ContentError::AlreadyDownloading => "NotCompleted",
    }
}

fn retryable(code: &str) -> bool {
    matches!(code, "ConnectionError" | "ConnectionTimeout" | "NoServer")
}

#[cfg(test)]
mod progress_tests {
    use super::*;

    #[test]
    fn cdn_retry_never_resets_download_progress() {
        let mut display = ProgressDisplay::default();
        assert_eq!(display.update("Progress", 42.0), Some(42.0));
        display.last -= Duration::from_secs(1);
        assert_eq!(display.update("Progress", 0.0), None);
        assert_eq!(display.update("Progress", 20.0), None);
        assert_eq!(display.update("Progress", 43.0), Some(43.0));
        assert_eq!(display.update("Validated", 0.0), Some(0.0));
    }
}
