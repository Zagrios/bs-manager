use crate::verification::{VerificationError, VerificationFile};

use super::{ContentError, format::ManifestFile, invalid};

pub(super) use crate::verification::verify_files;

impl VerificationFile for ManifestFile {
    fn name(&self) -> &str {
        &self.name
    }
    fn size(&self) -> u64 {
        self.size
    }
    fn sha1(&self) -> &[u8] {
        &self.sha
    }
    fn is_directory(&self) -> bool {
        ManifestFile::is_directory(self)
    }
}

impl From<VerificationError> for ContentError {
    fn from(error: VerificationError) -> Self {
        match error {
            VerificationError::Cancelled => Self::Cancelled,
            VerificationError::Install(error) => error.into(),
            VerificationError::SchedulerFailed => invalid("steam.verification.workerFailed"),
        }
    }
}
