use sysinfo::{Pid, ProcessRefreshKind, System};
use std::{env, thread, time::Duration, fs};
use std::ffi::OsStr;
use std::path::Path;
use std::str::FromStr;

const BEAT_SABER_OCULUS_FOLDER_NAME: &str = "hyperbolic-magnetism-beat-saber";

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        eprintln!("Usage: {} <pid> <path_to_directory>", args[0]);
        std::process::exit(1);
    }

    let pid: Pid = Pid::from_str(&args[1]).expect("Invalid pid");
    let directory_path = Path::new(&args[2]);

    if directory_path.file_name() != Some(OsStr::new(BEAT_SABER_OCULUS_FOLDER_NAME)) {
        eprintln!("Directory name is not {}", BEAT_SABER_OCULUS_FOLDER_NAME);
        std::process::exit(1);
    }

    // we want to monitor only processes
    let mut system = System::new_with_specifics(sysinfo::RefreshKind::new().with_processes(ProcessRefreshKind::everything()));

    loop {
        system.refresh_processes();
        let process = system.process(pid);

        match process {
            Some(_) => {
                println!("Process {} is still running.", pid);
                thread::sleep(Duration::from_secs(2));
            },
            None => {
                println!("Process {} has stopped, deleting directory {:?}", pid, directory_path);
                match delete_dir_if_is_symlink(directory_path) {
                    Ok(_) => {
                        println!("Directory {:?} deleted successfully.", directory_path);
                        if let Err(e) = rename_specific_backup_directory(directory_path.parent().unwrap()) {
                            eprintln!("Failed to rename backup directory: {}", e);
                        }
                    },
                    Err(e) => eprintln!("Failed to delete directory {:?}: {}", directory_path, e),
                }
                break;
            }
        }
    }
}

fn delete_dir_if_is_symlink(path: &Path) -> Result<(), Box<dyn std::error::Error>>{
    match path.symlink_metadata()?.file_type().is_symlink() {
        true => {
            fs::remove_dir_all(path)?;
            Ok(())
        },
        false => {
            eprintln!("Path {:?} is not a symlink.", path);
            Err("Path is not a symlink.".into())
        }
    }
}

fn rename_specific_backup_directory(parent_path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let backup_dir_name = format!("{}.bsmbak", BEAT_SABER_OCULUS_FOLDER_NAME);
    let backup_path = parent_path.join(&backup_dir_name);
    if backup_path.exists() && backup_path.is_dir() {
        let new_path = parent_path.join(BEAT_SABER_OCULUS_FOLDER_NAME);
        fs::rename(&backup_path, &new_path)?;
        println!("Renamed {:?} to {:?}", backup_path, new_path);
        Ok(())
    } else {
        Err(format!("Backup directory {:?} does not exist or is not a directory.", backup_path).into())
    }
}

