
use std::{process::Command, path::Path};

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let mut command = Command::new(args.get(1).unwrap());
    command.current_dir(Path::new(args.get(1).unwrap()).parent().unwrap());

    for arg in args.iter().skip(1) {
        command.arg(arg);
    }

    command.env("SteamAppId", "620980");

    let _ = command.spawn();
}
