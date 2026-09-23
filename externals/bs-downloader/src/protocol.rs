use crate::transfer::CancelToken;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, Read, Write};
use std::path::PathBuf;
use tokio::sync::mpsc;

pub const VERSION: u8 = 1;
const MAX_COMMAND: u64 = 128 * 1024;
#[derive(Deserialize)]
#[serde(tag = "command", rename_all = "camelCase", deny_unknown_fields)]
pub enum Command {
    Start { version: u8, options: Options },
    Input { value: String },
    Cancel,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Options {
    pub app: u32,
    pub depot: u32,
    pub manifest: String,
    pub directory: PathBuf,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub qr: bool,
}

impl Options {
    pub fn manifest_id(&self) -> Result<u64, &'static str> {
        if self.app != 620980 || self.depot != 620981 || !self.directory.is_absolute() {
            return Err("InvalidManifest");
        }
        self.manifest
            .parse::<u64>()
            .ok()
            .filter(|id| *id > 0)
            .ok_or("InvalidManifest")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Event<'a, T: Serialize> {
    version: u8,
    #[serde(rename = "type")]
    kind: &'a str,
    sub_type: &'a str,
    data: T,
}

pub fn emit(kind: &str, sub_type: &str, data: impl Serialize) {
    let mut out = std::io::stdout().lock();
    let event = Event {
        version: VERSION,
        kind,
        sub_type,
        data,
    };
    if serde_json::to_writer(&mut out, &event).is_err()
        || out.write_all(b"\n").is_err()
        || out.flush().is_err()
    {
        std::process::exit(1);
    }
}

pub fn input(cancel: CancelToken) -> mpsc::Receiver<Command> {
    let (tx, rx) = mpsc::channel(8);
    std::thread::spawn(move || {
        let mut stdin = std::io::stdin().lock();
        loop {
            let mut line = String::new();
            let result = (&mut stdin).take(MAX_COMMAND + 1).read_line(&mut line);
            if !matches!(result, Ok(size) if size > 0 && size <= MAX_COMMAND as usize) {
                cancel.cancel();
                break;
            }
            match serde_json::from_str::<Command>(&line) {
                Ok(Command::Cancel) => {
                    cancel.cancel();
                    break;
                }
                Ok(command) => {
                    if tx.try_send(command).is_err() {
                        cancel.cancel();
                        break;
                    }
                }
                Err(_) => {
                    cancel.cancel();
                    break;
                }
            }
        }
    });
    rx
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn manifest_ids_are_lossless_strings_and_commands_are_strict() {
        let command: Command = serde_json::from_str(r#"{"command":"start","version":1,"options":{"app":620980,"depot":620981,"manifest":"18446744073709551615","directory":"/tmp/game"}}"#).unwrap();
        let Command::Start { options, .. } = command else {
            panic!()
        };
        assert_eq!(options.manifest.parse::<u64>().unwrap(), u64::MAX);
        assert!(
            serde_json::from_str::<Command>(
                r#"{"command":"input","value":"code","unexpected":true}"#
            )
            .is_err()
        );
    }
}
