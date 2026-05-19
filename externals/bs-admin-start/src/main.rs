
use std::{process::Command, path::Path};
use std::env::current_exe;
use std::fs::File;
use std::path::PathBuf;
use log::{error, info, LevelFilter};
use simplelog::{CombinedLogger, Config, WriteLogger};

const EXECUTABLE_NAME: &str = "Beat Saber.exe";
const AUTORIZED_ARGS: [&str; 8] = [
    "fpfc",
    "-vrmode",
    "oculus",
    "--verbose",
    "--no-yeet",
    "--disable-autoupdate",
    "--combine-logs",
    "editor"
];

fn main() {

    let default_log_file_path = current_exe().unwrap().with_file_name("bs-admin-start.log");
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


    let args: Vec<String> = std::env::args().collect();

    let executable_path = Path::new(&args[1]);

    if executable_path.file_name().unwrap() != EXECUTABLE_NAME {
        return error!("Executable path is not Beat Saber.exe.");
    }

    if !executable_path.exists() || !executable_path.is_file() {
        return error!("Executable path is not valid.");
    }

    let mut command = Command::new(executable_path);

    if let Some(parent_dir) = executable_path.parent() {
        command.current_dir(parent_dir);
    }

    for arg in args.iter().skip(2) {
        if !AUTORIZED_ARGS.contains(&arg.as_str()) {
            continue;
        }
        command.arg(arg);
    }

    command.env("SteamAppId", "620980");

    let res = command.spawn();

    if let Err(e) = res {
        return error!("Failed to start Beat Saber ({}): {}", executable_path.display(), e);
    }

    info!("Beat Saber started ({})", executable_path.display());
}
