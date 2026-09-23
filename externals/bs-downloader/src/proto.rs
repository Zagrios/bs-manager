#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct Header {
    #[prost(fixed64, optional, tag = "1")]
    pub steam_id: Option<u64>,
    #[prost(int32, optional, tag = "2")]
    pub session_id: Option<i32>,
    #[prost(fixed64, optional, tag = "10")]
    pub job_source: Option<u64>,
    #[prost(fixed64, optional, tag = "11")]
    pub job_target: Option<u64>,
    #[prost(string, optional, tag = "12")]
    pub target_name: Option<String>,
    #[prost(int32, optional, tag = "13")]
    pub result: Option<i32>,
    #[prost(int32, optional, tag = "17")]
    pub transport_error: Option<i32>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct Multi {
    #[prost(uint32, tag = "1")]
    pub size_unzipped: u32,
    #[prost(bytes = "bytes", tag = "2")]
    pub body: bytes::Bytes,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct Hello {
    #[prost(uint32, tag = "1")]
    pub protocol_version: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct Heartbeat {
    #[prost(bool, tag = "1")]
    pub send_reply: bool,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct Logon {
    #[prost(uint32, tag = "1")]
    pub protocol_version: u32,
    #[prost(uint32, tag = "2")]
    pub deprecated_obfuscated_private_ip: u32,
    #[prost(uint32, tag = "5")]
    pub package_version: u32,
    #[prost(string, tag = "6")]
    pub language: String,
    #[prost(uint32, tag = "7")]
    pub os_type: u32,
    #[prost(bool, tag = "8")]
    pub remember_password: bool,
    #[prost(message, optional, tag = "11")]
    pub obfuscated_private_ip: Option<LoginAddress>,
    #[prost(string, tag = "50")]
    pub account_name: String,
    #[prost(string, tag = "96")]
    pub machine_name: String,
    #[prost(bool, tag = "102")]
    pub supports_rate_limit: bool,
    #[prost(string, tag = "108")]
    pub access_token: String,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct LoginAddress {
    #[prost(fixed32, tag = "1")]
    pub v4: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct LogonResponse {
    #[prost(int32, optional, tag = "1")]
    pub result: Option<i32>,
    #[prost(int32, tag = "2")]
    pub out_of_game_heartbeat: i32,
    #[prost(int32, tag = "3")]
    pub heartbeat: i32,
    #[prost(uint32, tag = "7")]
    pub cell_id: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct LoggedOff {
    #[prost(int32, optional, tag = "1")]
    pub result: Option<i32>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct DepotKeyRequest {
    #[prost(uint32, tag = "1")]
    pub depot_id: u32,
    #[prost(uint32, tag = "2")]
    pub app_id: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct DepotKeyResponse {
    #[prost(int32, optional, tag = "1")]
    pub result: Option<i32>,
    #[prost(uint32, tag = "2")]
    pub depot_id: u32,
    #[prost(bytes = "vec", tag = "3")]
    pub key: Vec<u8>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct ServerRequest {
    #[prost(uint32, tag = "1")]
    pub cell_id: u32,
    #[prost(uint32, tag = "2")]
    pub max_servers: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct ServerResponse {
    #[prost(message, repeated, tag = "1")]
    pub servers: Vec<ServerInfo>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct ServerInfo {
    #[prost(string, tag = "1")]
    pub server_type: String,
    #[prost(float, tag = "5")]
    pub weighted_load: f32,
    #[prost(string, tag = "8")]
    pub host: String,
    #[prost(string, tag = "9")]
    pub vhost: String,
    #[prost(bool, tag = "10")]
    pub use_as_proxy: bool,
    #[prost(string, tag = "12")]
    pub https_support: String,
    #[prost(uint32, repeated, packed = "false", tag = "13")]
    pub allowed_app_ids: Vec<u32>,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct ManifestCodeRequest {
    #[prost(uint32, tag = "1")]
    pub app_id: u32,
    #[prost(uint32, tag = "2")]
    pub depot_id: u32,
    #[prost(uint64, tag = "3")]
    pub manifest_id: u64,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct ManifestCodeResponse {
    #[prost(uint64, tag = "1")]
    pub code: u64,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct CdnAuthRequest {
    #[prost(uint32, tag = "1")]
    pub depot_id: u32,
    #[prost(string, tag = "2")]
    pub host: String,
    #[prost(uint32, tag = "3")]
    pub app_id: u32,
}

#[derive(Clone, PartialEq, prost::Message)]
pub(crate) struct CdnAuthResponse {
    #[prost(string, tag = "1")]
    pub token: String,
}
