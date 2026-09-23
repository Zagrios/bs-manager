use std::{
    fs::{self, File, OpenOptions},
    io::{self, Read},
    path::{Component, Path, PathBuf},
};

use sha1::{Digest, Sha1};
use thiserror::Error;

use crate::{
    atomic_file::write_atomic_with,
    transfer::{CancelToken, Cancelled},
};
pub fn sync_directory(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    File::open(path)?.sync_all()?;
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}
pub const PARTIAL_DIRECTORY: &str = ".bs-download";
pub const RECEIPT_FILE: &str = ".bs-download-install.json";
pub const LOCK_FILE: &str = ".bs-download-install.lock";
pub const ENGINE_LOCK_FILE: &str = "install.lock";

#[derive(Debug, Error)]
pub enum InstallError {
    #[error("cancelled")]
    Cancelled,
    #[error("unsafe path: {0}")]
    UnsafePath(String),
    #[error(transparent)]
    Io(#[from] io::Error),
}

impl From<Cancelled> for InstallError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}
pub fn hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for &byte in bytes {
        output.push(DIGITS[usize::from(byte >> 4)] as char);
        output.push(DIGITS[usize::from(byte & 15)] as char);
    }
    output
}
pub fn safe_relative_path(name: &str) -> Result<PathBuf, InstallError> {
    let normalized = name.replace('\\', "/");
    if normalized.is_empty()
        || normalized.starts_with('/')
        || normalized.contains(['\0', ':'])
        || normalized
            .split('/')
            .any(|part| matches!(part, "" | "." | ".."))
        || normalized.split('/').next().is_some_and(|part| {
            part.eq_ignore_ascii_case(PARTIAL_DIRECTORY)
                || part.eq_ignore_ascii_case(RECEIPT_FILE)
                || part.eq_ignore_ascii_case(LOCK_FILE)
        })
    {
        return Err(InstallError::UnsafePath(name.into()));
    }
    let path = PathBuf::from(normalized);
    if !path
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
    {
        return Err(InstallError::UnsafePath(name.into()));
    }
    Ok(path)
}
pub fn ensure_directory(root: &Path, relative: &Path) -> Result<PathBuf, InstallError> {
    let mut path = root.to_path_buf();
    for component in relative.components() {
        let Component::Normal(name) = component else {
            return Err(InstallError::UnsafePath(relative.display().to_string()));
        };
        path.push(name);
        match fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => {}
            Ok(_) => return Err(InstallError::UnsafePath(path.display().to_string())),
            Err(error) if error.kind() == io::ErrorKind::NotFound => fs::create_dir(&path)?,
            Err(error) => return Err(error.into()),
        }
    }
    Ok(path)
}
pub fn checked_file_path(root: &Path, relative: &Path) -> Result<PathBuf, InstallError> {
    let mut path = root.to_path_buf();
    let count = relative.components().count();
    for (index, component) in relative.components().enumerate() {
        let Component::Normal(name) = component else {
            return Err(InstallError::UnsafePath(relative.display().to_string()));
        };
        path.push(name);
        let last = index + 1 == count;
        match fs::symlink_metadata(&path) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink()
                    || !last && !metadata.is_dir()
                    || last && !metadata.is_file()
                    || last && has_extra_links(&metadata)
                {
                    return Err(InstallError::UnsafePath(path.display().to_string()));
                }
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    Ok(path)
}
pub fn reject_link_or_special_file(path: &Path) -> Result<(), InstallError> {
    match fs::symlink_metadata(path) {
        Ok(metadata)
            if !metadata.is_file()
                || metadata.file_type().is_symlink()
                || has_extra_links(&metadata) =>
        {
            Err(InstallError::UnsafePath(path.display().to_string()))
        }
        Ok(_) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.into()),
    }
}

fn has_extra_links(metadata: &fs::Metadata) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        metadata.nlink() > 1
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        false
    }
}
pub fn existing_plain_directory(path: &Path) -> Result<bool, InstallError> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata.file_type().is_symlink() => Ok(true),
        Ok(_) => Err(InstallError::UnsafePath(path.display().to_string())),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error.into()),
    }
}
pub fn try_lock_file(path: &Path) -> io::Result<Option<File>> {
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)?;
    Ok(file.try_lock().is_ok().then_some(file))
}
pub fn lock_engine(root: &Path) -> Result<Option<File>, InstallError> {
    let cache = ensure_directory(root, Path::new(PARTIAL_DIRECTORY))?;
    let path = checked_file_path(&cache, Path::new(ENGINE_LOCK_FILE))?;
    try_lock_file(&path).map_err(Into::into)
}
pub fn read_file_bounded(path: &Path, limit: usize) -> io::Result<Option<Vec<u8>>> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error),
    };
    if file.metadata()?.len() > limit as u64 {
        return Ok(None);
    }
    let mut bytes = Vec::new();
    file.take(limit as u64 + 1).read_to_end(&mut bytes)?;
    Ok((bytes.len() <= limit).then_some(bytes))
}
pub fn read_cached_file(
    root: &Path,
    relative: &Path,
    limit: usize,
) -> Result<Option<Vec<u8>>, InstallError> {
    if !existing_plain_directory(root)? {
        return Ok(None);
    }
    let path = checked_file_path(root, relative)?;
    Ok(read_file_bounded(&path, limit)?)
}
pub fn write_cached_file(root: &Path, relative: &Path, bytes: &[u8]) -> Result<(), InstallError> {
    if !existing_plain_directory(root)? {
        return Err(io::Error::from(io::ErrorKind::NotFound).into());
    }
    ensure_directory(root, relative.parent().unwrap_or(Path::new("")))?;
    let path = checked_file_path(root, relative)?;
    write_atomic_with(&path, bytes, || checked_file_path(root, relative).map(drop))
}
pub fn verify_sha1_file(
    path: &Path,
    size: u64,
    expected: &[u8],
    cancel: &CancelToken,
) -> Result<bool, InstallError> {
    verify_sha1_file_with_progress(path, size, expected, cancel, |_| {})
}
pub(crate) fn verify_sha1_file_with_progress(
    path: &Path,
    size: u64,
    expected: &[u8],
    cancel: &CancelToken,
    mut progress: impl FnMut(u64),
) -> Result<bool, InstallError> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    if file.metadata()?.len() != size {
        return Ok(false);
    }
    let mut hasher = Sha1::new();
    let mut buffer = [0_u8; 64 * 1024];
    let mut pending = 0_u64;
    loop {
        cancel.check()?;
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        pending += count as u64;
        if pending >= 1024 * 1024 {
            progress(pending);
            pending = 0;
        }
    }
    if pending != 0 {
        progress(pending);
    }
    Ok(hasher.finalize()[..] == *expected)
}
pub fn apply_permissions(path: &Path, executable: bool) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = if executable { 0o755 } else { 0o644 };
        fs::set_permissions(path, fs::Permissions::from_mode(mode))?;
    }
    #[cfg(not(unix))]
    {
        let _ = (path, executable);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_paths_reject_escapes_and_reserved_names() {
        for name in [
            "",
            "/absolute",
            "C:\\outside",
            "../outside",
            "safe/../outside",
            "safe/./file",
            "safe//file",
            "nul\0byte",
            ".bs-download/lock",
            ".BS-DOWNLOAD-INSTALL.json",
            ".bs-download-install.lock",
        ] {
            assert!(
                matches!(safe_relative_path(name), Err(InstallError::UnsafePath(_))),
                "{name:?}"
            );
        }
        assert_eq!(
            safe_relative_path("Game.app\\Contents/MacOS\\Game").unwrap(),
            Path::new("Game.app/Contents/MacOS/Game")
        );
    }

    #[test]
    fn bounded_reads_treat_missing_and_oversized_files_as_absent() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("cache");
        assert!(read_file_bounded(&path, 4).unwrap().is_none());
        fs::write(&path, b"12345").unwrap();
        assert!(read_file_bounded(&path, 4).unwrap().is_none());
        assert_eq!(read_file_bounded(&path, 5).unwrap().unwrap(), b"12345");
    }

    #[test]
    fn cached_files_round_trip_under_an_existing_root_only() {
        let directory = tempfile::tempdir().unwrap();
        let relative = Path::new(PARTIAL_DIRECTORY).join("manifests/1.bin");
        let missing_root = directory.path().join("missing");
        assert!(
            read_cached_file(&missing_root, &relative, 16)
                .unwrap()
                .is_none()
        );
        assert!(matches!(
            write_cached_file(&missing_root, &relative, b"x"),
            Err(InstallError::Io(_))
        ));
        write_cached_file(directory.path(), &relative, b"payload").unwrap();
        assert_eq!(
            read_cached_file(directory.path(), &relative, 16)
                .unwrap()
                .unwrap(),
            b"payload"
        );
    }

    #[cfg(unix)]
    #[test]
    fn confined_paths_refuse_links_and_special_files() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        assert!(matches!(
            checked_file_path(root.path(), Path::new("link/game")),
            Err(InstallError::UnsafePath(_))
        ));
        assert!(matches!(
            ensure_directory(root.path(), Path::new("link")),
            Err(InstallError::UnsafePath(_))
        ));
        fs::write(outside.path().join("original"), b"unchanged").unwrap();
        fs::hard_link(
            outside.path().join("original"),
            root.path().join("hardlink"),
        )
        .unwrap();
        assert!(matches!(
            checked_file_path(root.path(), Path::new("hardlink")),
            Err(InstallError::UnsafePath(_))
        ));
        assert!(matches!(
            reject_link_or_special_file(&root.path().join("hardlink")),
            Err(InstallError::UnsafePath(_))
        ));
        fs::write(root.path().join("plain"), b"file").unwrap();
        assert!(matches!(
            checked_file_path(root.path(), Path::new("plain/child")),
            Err(InstallError::UnsafePath(_))
        ));
        assert!(checked_file_path(root.path(), Path::new("new/file")).is_ok());
        assert!(reject_link_or_special_file(&root.path().join("plain")).is_ok());
    }

    #[test]
    fn the_engine_lock_is_exclusive_and_released_with_its_handle() {
        let root = tempfile::tempdir().unwrap();
        let held = lock_engine(root.path())
            .unwrap()
            .expect("first worker takes it");
        assert!(
            root.path()
                .join(PARTIAL_DIRECTORY)
                .join(ENGINE_LOCK_FILE)
                .is_file(),
            "the lock lives inside the installation's own partial directory"
        );
        assert!(
            lock_engine(root.path()).unwrap().is_none(),
            "a second worker is refused while the first holds it"
        );
        drop(held);
        assert!(lock_engine(root.path()).unwrap().is_some());
    }

    #[cfg(unix)]
    #[test]
    fn the_engine_lock_refuses_a_redirected_partial_directory() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), root.path().join(PARTIAL_DIRECTORY)).unwrap();
        assert!(matches!(
            lock_engine(root.path()),
            Err(InstallError::UnsafePath(_))
        ));
    }

    #[test]
    fn sha1_verification_handles_missing_and_mismatched_files() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("file");
        let cancel = CancelToken::new();
        let digest: [u8; 20] = Sha1::digest(b"content").into();
        assert!(!verify_sha1_file(&path, 7, &digest, &cancel).unwrap());
        fs::write(&path, b"content").unwrap();
        assert!(verify_sha1_file(&path, 7, &digest, &cancel).unwrap());
        assert!(!verify_sha1_file(&path, 8, &digest, &cancel).unwrap());
        assert!(!verify_sha1_file(&path, 7, &[0; 20], &cancel).unwrap());
        cancel.cancel();
        assert!(matches!(
            verify_sha1_file(&path, 7, &digest, &cancel),
            Err(InstallError::Cancelled)
        ));
    }
}
