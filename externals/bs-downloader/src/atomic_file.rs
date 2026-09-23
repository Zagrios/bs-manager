use std::fs::File;
use std::io::{self, Write};
use std::path::Path;

use tempfile::NamedTempFile;
pub fn write_atomic_with<E: From<io::Error>>(
    path: &Path,
    bytes: &[u8],
    before_replace: impl FnOnce() -> Result<(), E>,
) -> Result<(), E> {
    let directory = path.parent().unwrap_or_else(|| Path::new("."));
    let mut temporary = NamedTempFile::new_in(directory)?;
    temporary.write_all(bytes)?;
    temporary.as_file().sync_all()?;
    before_replace()?;
    temporary.persist(path).map_err(|error| error.error)?;
    if let Ok(directory) = File::open(directory) {
        let _ = directory.sync_all();
    }
    Ok(())
}
