
use std::{process::Command, path::Path};

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
    let args: Vec<String> = std::env::args().collect();

    let executable_path = Path::new(&args[1]);

    if executable_path.file_name().unwrap() != EXECUTABLE_NAME {
        eprintln!("Executable path is not Beat Saber.exe.");
        return;
    }

    if !executable_path.exists() || !executable_path.is_file() {
        eprintln!("Executable path is not valid.");
        return;
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

    let _ = command.spawn();
}
