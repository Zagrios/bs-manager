#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct PasswordKeyRequest {
    #[prost(string, tag = "1")]
    pub account_name: String,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct PasswordKeyResponse {
    #[prost(string, tag = "1")]
    pub modulus: String,
    #[prost(string, tag = "2")]
    pub exponent: String,
    #[prost(uint64, tag = "3")]
    pub timestamp: u64,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct DeviceDetails {
    #[prost(string, tag = "1")]
    pub name: String,
    #[prost(int32, tag = "2")]
    pub platform: i32,
    #[prost(int32, tag = "3")]
    pub os_type: i32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct BeginQrRequest {
    #[prost(message, optional, tag = "3")]
    pub device: Option<DeviceDetails>,
    #[prost(string, tag = "4")]
    pub website: String,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct Confirmation {
    #[prost(int32, tag = "1")]
    pub kind: i32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct BeginQrResponse {
    #[prost(uint64, tag = "1")]
    pub client_id: u64,
    #[prost(string, tag = "2")]
    pub challenge_url: String,
    #[prost(bytes = "vec", tag = "3")]
    pub request_id: Vec<u8>,
    #[prost(float, tag = "4")]
    pub interval: f32,
    #[prost(message, repeated, tag = "5")]
    pub confirmations: Vec<Confirmation>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct BeginCredentialsRequest {
    #[prost(string, tag = "2")]
    pub account_name: String,
    #[prost(string, tag = "3")]
    pub encrypted_password: String,
    #[prost(uint64, tag = "4")]
    pub encryption_timestamp: u64,
    #[prost(bool, tag = "5")]
    pub remember_login: bool,
    #[prost(int32, tag = "7")]
    pub persistence: i32,
    #[prost(string, tag = "8")]
    pub website: String,
    #[prost(message, optional, tag = "9")]
    pub device: Option<DeviceDetails>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct BeginCredentialsResponse {
    #[prost(uint64, tag = "1")]
    pub client_id: u64,
    #[prost(bytes = "vec", tag = "2")]
    pub request_id: Vec<u8>,
    #[prost(float, tag = "3")]
    pub interval: f32,
    #[prost(message, repeated, tag = "4")]
    pub confirmations: Vec<Confirmation>,
    #[prost(uint64, tag = "5")]
    pub steam_id: u64,
    #[prost(string, tag = "7")]
    pub agreement_url: String,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct GuardRequest {
    #[prost(uint64, tag = "1")]
    pub client_id: u64,
    #[prost(fixed64, tag = "2")]
    pub steam_id: u64,
    #[prost(string, tag = "3")]
    pub code: String,
    #[prost(int32, tag = "4")]
    pub kind: i32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct GuardResponse {
    #[prost(string, tag = "7")]
    pub agreement_url: String,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct PollRequest {
    #[prost(uint64, tag = "1")]
    pub client_id: u64,
    #[prost(bytes = "vec", tag = "2")]
    pub request_id: Vec<u8>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(super) struct PollResponse {
    #[prost(uint64, tag = "1")]
    pub new_client_id: u64,
    #[prost(string, tag = "2")]
    pub new_challenge_url: String,
    #[prost(string, tag = "3")]
    pub refresh_token: String,
    #[prost(string, tag = "6")]
    pub account_name: String,
    #[prost(string, tag = "8")]
    pub agreement_url: String,
}
