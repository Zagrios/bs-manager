use std::env::current_exe;
use std::fs::File;
use std::path::PathBuf;
use simplelog::{CombinedLogger, Config, LevelFilter, WriteLogger};
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;
use log::{error, info};

const REG_PATH: &str = "SOFTWARE\\Wow6432Node\\Oculus VR, LLC\\Oculus";

fn main() {

    let default_log_file_path = current_exe().unwrap().with_file_name("oculus-allow-dev-sideloaded.log");
    let args: Vec<String> = std::env::args().collect();

    let log_file_path: PathBuf = if let Some(pos) = args.iter().position(|arg| arg == "--log-path") {
        if let Some(log_path) = args.get(pos + 1) {
            PathBuf::from(log_path)
        } else {
            default_log_file_path
        }
    } else {
        default_log_file_path
    };

    CombinedLogger::init(
        vec![
            WriteLogger::new(LevelFilter::Info, Config::default(), File::create(log_file_path).unwrap()),
        ]
    ).unwrap();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    info!("Opening or creating subkey ({})...", REG_PATH);
    let (key, _) = match hklm.create_subkey(REG_PATH) {
        Ok(res) => res,
        Err(err) => return error!("Unable to create subkey ({}) : {}", REG_PATH, err.to_string())
    };

    info!("Setting value AllowDevSideloaded = 1 in {REG_PATH}...");
    let res = key.set_value("AllowDevSideloaded", &1u32);

    if let Err(err) = res {
        return error!("Unable to set value AllowDevSideloaded = 1 in {REG_PATH} : {}", err.to_string());
    }

    info!("AllowDevSideloaded = 1 has been successfully set in {REG_PATH}");
}
