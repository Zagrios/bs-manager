mod atomic_file;
mod auth;
mod cm;
mod content;
mod install;
mod message;
mod network;
mod proto;
pub mod protocol;
pub mod runner;
pub mod transfer;
mod verification;

fn os_type() -> u32 {
    if cfg!(target_os = "windows") {
        20
    } else {
        (-203_i32) as u32
    }
}
