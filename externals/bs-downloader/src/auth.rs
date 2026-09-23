mod wire;

#[cfg(test)]
mod tests;

use std::time::Duration;

use base64::{Engine as _, engine::general_purpose};
use prost::Message;
use reqwest::{Client, Method};
use rsa::{BigUint, Pkcs1v15Encrypt, RsaPublicKey, rand_core::OsRng, traits::PublicKeyParts};
use thiserror::Error;

const AUTH_API: &str = "https://api.steampowered.com/IAuthenticationService";
const MAX_RESPONSE_BYTES: usize = 1_048_576;
const MAX_TOKEN_BYTES: usize = 32_768;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AuthError {
    #[error("steam.auth.invalidCredentialsInput")]
    InvalidCredentialsInput,
    #[error("steam.auth.credentialsRejected")]
    CredentialsRejected,
    #[error("steam.auth.guardRejected")]
    GuardRejected,
    #[error("steam.auth.unsupportedConfirmation")]
    UnsupportedConfirmation,
    #[error("steam.auth.expired")]
    Expired,
    #[error("steam.auth.rateLimited")]
    RateLimited,
    #[error("steam.auth.agreementRequired")]
    AgreementRequired,
    #[error("steam.auth.network")]
    Network,
    #[error("{}", crate::message::format("steam.auth.http", &[.status.to_string()]))]
    Http { status: u16 },
    #[error("{}", crate::message::format("steam.auth.steam", &[.result.to_string()]))]
    Steam { result: i32 },
    #[error("steam.auth.protocol")]
    Protocol,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GuardType {
    None,
    EmailCode,
    DeviceCode,
    DeviceConfirmation,
    EmailConfirmation,
    MachineToken,
    Unknown,
}

impl GuardType {
    fn from_wire(value: i32) -> Self {
        match value {
            1 => Self::None,
            2 => Self::EmailCode,
            3 => Self::DeviceCode,
            4 => Self::DeviceConfirmation,
            5 => Self::EmailConfirmation,
            6 => Self::MachineToken,
            _ => Self::Unknown,
        }
    }

    fn code_value(self) -> Result<i32, AuthError> {
        match self {
            Self::EmailCode => Ok(2),
            Self::DeviceCode => Ok(3),
            _ => Err(AuthError::UnsupportedConfirmation),
        }
    }
}

pub struct AuthSession {
    client_id: u64,
    request_id: Vec<u8>,
    steam_id: Option<u64>,
    challenge_url: Option<String>,
    confirmations: Vec<GuardType>,
    interval: Duration,
    completed: bool,
}

impl AuthSession {
    pub fn challenge_url(&self) -> Option<&str> {
        self.challenge_url.as_deref()
    }

    pub fn allowed_confirmations(&self) -> &[GuardType] {
        &self.confirmations
    }
    pub fn polling_interval(&self) -> Duration {
        self.interval
    }
}
pub struct AuthTokens {
    pub account_name: String,
    pub steam_id: u64,
    pub refresh_token: String,
}

impl AuthTokens {
    pub fn restore(account_name: String, refresh_token: String) -> Result<Self, AuthError> {
        if account_name.is_empty() || account_name.len() > 256 {
            return Err(AuthError::Protocol);
        }
        let steam_id = steam_id_from_refresh_token(&refresh_token)?;
        Ok(Self {
            account_name,
            steam_id,
            refresh_token,
        })
    }
}
pub fn steam_id_from_refresh_token(token: &str) -> Result<u64, AuthError> {
    if token.len() > MAX_TOKEN_BYTES {
        return Err(AuthError::Protocol);
    }
    let mut components = token.split('.');
    let header = components.next().ok_or(AuthError::Protocol)?;
    let payload = components.next().ok_or(AuthError::Protocol)?;
    let signature = components.next().ok_or(AuthError::Protocol)?;
    if header.is_empty() || signature.is_empty() || components.next().is_some() {
        return Err(AuthError::Protocol);
    }
    let payload = general_purpose::URL_SAFE_NO_PAD
        .decode(payload)
        .map_err(|_| AuthError::Protocol)?;
    let claims: serde_json::Value =
        serde_json::from_slice(&payload).map_err(|_| AuthError::Protocol)?;
    let steam_id = claims
        .get("sub")
        .and_then(serde_json::Value::as_str)
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| valid_individual_steam_id(*value))
        .ok_or(AuthError::Protocol)?;
    Ok(steam_id)
}

fn valid_individual_steam_id(value: u64) -> bool {
    value >> 56 == 1 && (value >> 52) & 0xf == 1 && value as u32 != 0
}

pub struct AuthClient {
    http: Client,
    endpoint: String,
}

impl AuthClient {
    pub fn new(http: Client) -> Self {
        Self {
            http,
            endpoint: AUTH_API.into(),
        }
    }

    pub async fn begin_qr(&self) -> Result<AuthSession, AuthError> {
        let response: wire::BeginQrResponse = self
            .call(
                Method::POST,
                "BeginAuthSessionViaQR",
                &wire::BeginQrRequest {
                    device: Some(device_details()),
                    website: "Client".into(),
                },
                false,
            )
            .await?;
        let challenge_url = validate_challenge_url(response.challenge_url)?;
        make_session(
            response.client_id,
            response.request_id,
            None,
            Some(challenge_url),
            response.confirmations,
            response.interval,
        )
    }

    pub async fn begin_credentials(
        &self,
        account_name: &str,
        password: &str,
    ) -> Result<AuthSession, AuthError> {
        let account_name = account_name.trim();
        if account_name.is_empty()
            || account_name.len() > 256
            || password.is_empty()
            || password.len() > 256
        {
            return Err(AuthError::InvalidCredentialsInput);
        }
        let key: wire::PasswordKeyResponse = self
            .call(
                Method::GET,
                "GetPasswordRSAPublicKey",
                &wire::PasswordKeyRequest {
                    account_name: account_name.into(),
                },
                false,
            )
            .await?;
        let encrypted_password = encrypt_password(password, &key)?;
        let response: wire::BeginCredentialsResponse = self
            .call(
                Method::POST,
                "BeginAuthSessionViaCredentials",
                &wire::BeginCredentialsRequest {
                    account_name: account_name.into(),
                    encrypted_password,
                    encryption_timestamp: key.timestamp,
                    remember_login: true,
                    persistence: 1,
                    website: "Client".into(),
                    device: Some(device_details()),
                },
                false,
            )
            .await?;
        require_no_agreement(&response.agreement_url)?;
        if !valid_individual_steam_id(response.steam_id) {
            return Err(AuthError::Protocol);
        }
        make_session(
            response.client_id,
            response.request_id,
            Some(response.steam_id),
            None,
            response.confirmations,
            response.interval,
        )
    }

    pub async fn submit_guard(
        &self,
        session: &AuthSession,
        code: &str,
        kind: GuardType,
    ) -> Result<(), AuthError> {
        if session.completed {
            return Err(AuthError::Expired);
        }
        let kind_value = kind.code_value()?;
        if !session.confirmations.contains(&kind) {
            return Err(AuthError::UnsupportedConfirmation);
        }
        let steam_id = session.steam_id.ok_or(AuthError::UnsupportedConfirmation)?;
        let code = code.trim();
        if code.len() != 5 || !code.bytes().all(|byte| byte.is_ascii_alphanumeric()) {
            return Err(AuthError::GuardRejected);
        }
        let response: wire::GuardResponse = self
            .call(
                Method::POST,
                "UpdateAuthSessionWithSteamGuardCode",
                &wire::GuardRequest {
                    client_id: session.client_id,
                    steam_id,
                    code: code.to_ascii_uppercase(),
                    kind: kind_value,
                },
                true,
            )
            .await?;
        require_no_agreement(&response.agreement_url)
    }

    pub async fn poll(&self, session: &mut AuthSession) -> Result<Option<AuthTokens>, AuthError> {
        if session.completed {
            return Err(AuthError::Expired);
        }
        let response: wire::PollResponse = self
            .call(
                Method::POST,
                "PollAuthSessionStatus",
                &wire::PollRequest {
                    client_id: session.client_id,
                    request_id: session.request_id.clone(),
                },
                false,
            )
            .await?;
        apply_poll_response(session, response)
    }

    async fn call<Request, Response>(
        &self,
        method: Method,
        operation: &'static str,
        input: &Request,
        accept_duplicate: bool,
    ) -> Result<Response, AuthError>
    where
        Request: Message,
        Response: Message + Default,
    {
        let fields = [
            ("format", "protobuf_raw".to_owned()),
            (
                "input_protobuf_encoded",
                general_purpose::STANDARD.encode(input.encode_to_vec()),
            ),
        ];
        let request = self
            .http
            .request(method.clone(), format!("{}/{operation}/v1/", self.endpoint))
            .timeout(Duration::from_secs(30));
        let request = if method == Method::GET {
            request.query(&fields)
        } else {
            request.form(&fields)
        };
        let response = request.send().await.map_err(|_| AuthError::Network)?;
        if response.status().as_u16() == 429 {
            return Err(AuthError::RateLimited);
        }
        let result = response
            .headers()
            .get("x-eresult")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<i32>().ok());
        if let Some(result) = result {
            check_result(result, accept_duplicate)?;
        }
        if !response.status().is_success() {
            return Err(AuthError::Http {
                status: response.status().as_u16(),
            });
        }
        if result.is_none() {
            return Err(AuthError::Protocol);
        }
        let body = crate::network::read_bounded(response, MAX_RESPONSE_BYTES)
            .await
            .map_err(|error| match error {
                crate::network::BodyError::Network => AuthError::Network,
                crate::network::BodyError::TooLarge => AuthError::Protocol,
            })?;
        Response::decode(body.as_slice()).map_err(|_| AuthError::Protocol)
    }
}

fn device_details() -> wire::DeviceDetails {
    wire::DeviceDetails {
        name: "BSManager".into(),
        platform: 1,
        os_type: crate::os_type() as i32,
    }
}

fn encrypt_password(
    password: &str,
    response: &wire::PasswordKeyResponse,
) -> Result<String, AuthError> {
    if response.timestamp == 0
        || !(512..=1024).contains(&response.modulus.len())
        || response.exponent.len() > 8
    {
        return Err(AuthError::Protocol);
    }
    let modulus =
        BigUint::parse_bytes(response.modulus.as_bytes(), 16).ok_or(AuthError::Protocol)?;
    let exponent =
        BigUint::parse_bytes(response.exponent.as_bytes(), 16).ok_or(AuthError::Protocol)?;
    let key = RsaPublicKey::new(modulus, exponent).map_err(|_| AuthError::Protocol)?;
    if !(2048..=4096).contains(&key.n().bits()) {
        return Err(AuthError::Protocol);
    }
    if password.len() > key.size().saturating_sub(11) {
        return Err(AuthError::InvalidCredentialsInput);
    }
    let encrypted = key
        .encrypt(&mut OsRng, Pkcs1v15Encrypt, password.as_bytes())
        .map_err(|_| AuthError::Protocol)?;
    Ok(general_purpose::STANDARD.encode(encrypted))
}

fn make_session(
    client_id: u64,
    request_id: Vec<u8>,
    steam_id: Option<u64>,
    challenge_url: Option<String>,
    confirmations: Vec<wire::Confirmation>,
    interval: f32,
) -> Result<AuthSession, AuthError> {
    if client_id == 0
        || request_id.is_empty()
        || request_id.len() > 4096
        || !interval.is_finite()
        || interval <= 0.0
        || interval > 300.0
        || confirmations.is_empty()
        || confirmations.len() > 32
    {
        return Err(AuthError::Protocol);
    }
    let confirmations: Vec<_> = confirmations
        .into_iter()
        .map(|confirmation| GuardType::from_wire(confirmation.kind))
        .collect();
    if !confirmations.iter().any(|value| {
        matches!(
            value,
            GuardType::None
                | GuardType::EmailCode
                | GuardType::DeviceCode
                | GuardType::DeviceConfirmation
                | GuardType::EmailConfirmation
        )
    }) {
        return Err(AuthError::UnsupportedConfirmation);
    }
    Ok(AuthSession {
        client_id,
        request_id,
        steam_id,
        challenge_url,
        confirmations,
        interval: Duration::from_secs_f32(interval.max(1.0)),
        completed: false,
    })
}

fn validate_challenge_url(value: String) -> Result<String, AuthError> {
    if value.len() > 4096 {
        return Err(AuthError::Protocol);
    }
    let url = reqwest::Url::parse(&value).map_err(|_| AuthError::Protocol)?;
    if url.scheme() != "https"
        || url.host_str() != Some("s.team")
        || !url.path().starts_with("/q/")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.port().is_some()
    {
        return Err(AuthError::Protocol);
    }
    Ok(value)
}

fn require_no_agreement(agreement_url: &str) -> Result<(), AuthError> {
    if agreement_url.is_empty() {
        Ok(())
    } else {
        Err(AuthError::AgreementRequired)
    }
}

fn check_result(result: i32, accept_duplicate: bool) -> Result<(), AuthError> {
    match result {
        1 => Ok(()),
        29 if accept_duplicate => Ok(()),
        5 => Err(AuthError::CredentialsRejected),
        65 | 88 => Err(AuthError::GuardRejected),
        9 | 27 => Err(AuthError::Expired),
        84 | 87 => Err(AuthError::RateLimited),
        _ => Err(AuthError::Steam { result }),
    }
}

fn apply_poll_response(
    session: &mut AuthSession,
    response: wire::PollResponse,
) -> Result<Option<AuthTokens>, AuthError> {
    require_no_agreement(&response.agreement_url)?;
    if response.new_client_id != 0 {
        session.client_id = response.new_client_id;
    }
    if !response.new_challenge_url.is_empty() {
        session.challenge_url = Some(validate_challenge_url(response.new_challenge_url)?);
    }
    if response.refresh_token.is_empty() {
        return Ok(None);
    }
    let steam_id = steam_id_from_refresh_token(&response.refresh_token)?;
    if session
        .steam_id
        .is_some_and(|expected| expected != steam_id)
        || response.account_name.is_empty()
        || response.account_name.len() > 256
    {
        return Err(AuthError::Protocol);
    }
    session.completed = true;
    session.request_id.fill(0);
    session.challenge_url = None;
    Ok(Some(AuthTokens {
        account_name: response.account_name,
        steam_id,
        refresh_token: response.refresh_token,
    }))
}
