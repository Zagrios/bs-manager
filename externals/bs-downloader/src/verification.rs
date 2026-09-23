use std::{
    path::{Path, PathBuf},
    sync::{
        Mutex,
        atomic::{AtomicBool, AtomicUsize, Ordering},
    },
    thread,
};

use crate::{
    install::{self, InstallError},
    transfer::{CancelToken, Cancelled, Reporter},
};

const MAX_WORKERS: usize = 4;
pub trait VerificationFile {
    fn name(&self) -> &str;
    fn size(&self) -> u64;
    fn sha1(&self) -> &[u8];
    fn is_directory(&self) -> bool {
        false
    }
}

#[derive(Debug)]
pub enum VerificationError {
    Cancelled,
    Install(InstallError),
    SchedulerFailed,
}

impl From<Cancelled> for VerificationError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}

impl From<InstallError> for VerificationError {
    fn from(error: InstallError) -> Self {
        match error {
            InstallError::Cancelled => Self::Cancelled,
            other => Self::Install(other),
        }
    }
}
#[derive(Debug, Default)]
pub struct Verified {
    pub valid: Vec<bool>,
    pub reused_bytes: u64,
}

pub fn worker_limit() -> usize {
    thread::available_parallelism()
        .map(usize::from)
        .unwrap_or(1)
        .min(MAX_WORKERS)
}
pub fn verify_files<T>(
    root: &Path,
    files: &[T],
    cancel: &CancelToken,
    reporter: &Reporter,
) -> Result<Verified, VerificationError>
where
    T: VerificationFile + Sync,
{
    verify_with_workers(root, files, cancel, reporter, worker_limit())
}
pub fn verify_with_workers<T>(
    root: &Path,
    files: &[T],
    cancel: &CancelToken,
    reporter: &Reporter,
    workers: usize,
) -> Result<Verified, VerificationError>
where
    T: VerificationFile + Sync,
{
    cancel.check()?;
    reporter.update(|status| status.verification_bytes = Some(0));
    let verified = schedule(
        files,
        cancel,
        |file| confined_path(root, file),
        |path, file: &T, cancel| {
            let mut inspected = 0_u64;
            let mut report = |bytes: u64| {
                let bytes = bytes.min(file.size().saturating_sub(inspected));
                inspected += bytes;
                reporter.update(|status| {
                    status.verification_bytes =
                        Some(status.verification_bytes.unwrap_or(0).saturating_add(bytes));
                    status.current_file.replace_range(.., file.name());
                });
            };
            let valid = install::verify_sha1_file_with_progress(
                path,
                file.size(),
                file.sha1(),
                cancel,
                &mut report,
            )?;
            let remaining = file.size().saturating_sub(inspected);
            if remaining != 0 {
                reporter.update(|status| {
                    status.verification_bytes = Some(
                        status
                            .verification_bytes
                            .unwrap_or(0)
                            .saturating_add(remaining),
                    );
                    status.current_file.replace_range(.., file.name());
                });
            }
            Ok(valid)
        },
        |bytes, files, name| {
            reporter.update(|status| {
                status.completed_bytes = bytes;
                status.completed_files = files;
                status.current_file.replace_range(.., name);
            });
        },
        workers,
    )
    .map_err(|error| match error {
        ScheduleError::Cancelled => VerificationError::Cancelled,
        ScheduleError::File(error) => error.into(),
        ScheduleError::WorkerFailed
        | ScheduleError::InvalidTotalSize
        | ScheduleError::InvalidFileCount => VerificationError::SchedulerFailed,
    })?;
    reporter.update(|status| status.verification_bytes = None);
    Ok(verified)
}
fn confined_path<T: VerificationFile>(root: &Path, file: &T) -> Result<PathBuf, InstallError> {
    install::checked_file_path(root, &install::safe_relative_path(file.name())?)
}
#[derive(Debug)]
enum ScheduleError<E> {
    Cancelled,
    File(E),
    WorkerFailed,
    InvalidTotalSize,
    InvalidFileCount,
}

impl<E> From<Cancelled> for ScheduleError<E> {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}

struct CheckedFiles {
    valid: Vec<bool>,
    bytes: u64,
    files: u32,
}
fn schedule<T, P, E>(
    files: &[T],
    cancel: &CancelToken,
    prepare: impl Fn(&T) -> Result<P, E> + Sync,
    verify: impl Fn(&P, &T, &CancelToken) -> Result<bool, E> + Sync,
    progress: impl Fn(u64, u32, &str) + Sync,
    workers: usize,
) -> Result<Verified, ScheduleError<E>>
where
    T: VerificationFile + Sync,
    E: Send,
{
    cancel.check()?;
    let jobs: Vec<_> = files
        .iter()
        .enumerate()
        .filter(|(_, file)| !file.is_directory())
        .collect();
    let state = Mutex::new(CheckedFiles {
        valid: vec![false; files.len()],
        bytes: 0,
        files: 0,
    });
    let next = AtomicUsize::new(0);
    let stopped = AtomicBool::new(false);
    let count = workers.clamp(1, MAX_WORKERS).min(jobs.len());
    thread::scope(|scope| {
        let mut handles = Vec::with_capacity(count);
        for _ in 0..count {
            handles.push(scope.spawn(|| {
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    loop {
                        cancel.check()?;
                        if stopped.load(Ordering::Acquire) {
                            return Ok(());
                        }
                        let job = next.fetch_add(1, Ordering::Relaxed);
                        let Some(&(index, file)) = jobs.get(job) else {
                            return Ok(());
                        };
                        let prepared = prepare(file).map_err(ScheduleError::File)?;
                        {
                            let checked = state.lock().map_err(|_| ScheduleError::WorkerFailed)?;
                            progress(checked.bytes, checked.files, file.name());
                        }
                        cancel.check()?;
                        let valid = verify(&prepared, file, cancel).map_err(ScheduleError::File)?;
                        cancel.check()?;
                        let mut checked = state.lock().map_err(|_| ScheduleError::WorkerFailed)?;
                        checked.valid[index] = valid;
                        if valid {
                            checked.bytes = checked
                                .bytes
                                .checked_add(file.size())
                                .ok_or(ScheduleError::InvalidTotalSize)?;
                            checked.files = checked
                                .files
                                .checked_add(1)
                                .ok_or(ScheduleError::InvalidFileCount)?;
                        }
                        progress(checked.bytes, checked.files, file.name());
                    }
                }))
                .unwrap_or(Err(ScheduleError::WorkerFailed));
                if result.is_err() {
                    stopped.store(true, Ordering::Release);
                }
                result
            }));
        }
        let mut error = None;
        for handle in handles {
            let result = handle.join().unwrap_or(Err(ScheduleError::WorkerFailed));
            if let Err(failure) = result {
                stopped.store(true, Ordering::Release);
                if error.is_none() {
                    error = Some(failure);
                }
            }
        }
        error.map_or(Ok(()), Err)
    })?;
    cancel.check()?;
    let checked = state
        .into_inner()
        .map_err(|_| ScheduleError::WorkerFailed)?;
    Ok(Verified {
        valid: checked.valid,
        reused_bytes: checked.bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer::DownloadProgress;
    use sha1::{Digest, Sha1};
    use std::{fs, sync::Arc, sync::Barrier};
    fn recording() -> (Arc<Reporter>, Arc<Mutex<Vec<DownloadProgress>>>) {
        let log = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&log);
        let reporter = Reporter::new(DownloadProgress::default(), move |snapshot| {
            sink.lock().unwrap().push(snapshot);
        });
        (reporter, log)
    }
    fn silent() -> Arc<Reporter> {
        Reporter::new(DownloadProgress::default(), |_| {})
    }
    struct Entry {
        name: String,
        size: u64,
        sha: Vec<u8>,
        directory: bool,
    }

    impl VerificationFile for Entry {
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
            self.directory
        }
    }

    fn entry(name: &str, bytes: &[u8]) -> Entry {
        Entry {
            name: name.into(),
            size: bytes.len() as u64,
            sha: Sha1::digest(bytes).to_vec(),
            directory: false,
        }
    }
    struct Sized(u64);
    impl VerificationFile for Sized {
        fn name(&self) -> &str {
            "fixture"
        }
        fn size(&self) -> u64 {
            self.0
        }
        fn sha1(&self) -> &[u8] {
            &[]
        }
    }

    struct Reader<'a>(&'a AtomicUsize);
    impl Drop for Reader<'_> {
        fn drop(&mut self) {
            self.0.fetch_sub(1, Ordering::AcqRel);
        }
    }

    #[test]
    fn hashes_valid_corrupt_missing_and_directory_entries_under_the_root() {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir(root.path().join("folder")).unwrap();
        let bytes = vec![0x5a; 192 * 1024 + 17];
        fs::write(root.path().join("folder/valid"), &bytes).unwrap();
        fs::write(root.path().join("empty"), []).unwrap();
        let mut corrupt = bytes.clone();
        corrupt[128 * 1024] ^= 1;
        fs::write(root.path().join("corrupt"), corrupt).unwrap();
        fs::write(root.path().join("truncated"), &bytes[..100]).unwrap();
        let mut directory = entry("folder", &[]);
        directory.directory = true;
        let files = vec![
            directory,
            entry("folder/valid", &bytes),
            entry("empty", &[]),
            entry("corrupt", &bytes),
            entry("truncated", &bytes),
            entry("missing", &bytes),
        ];
        let (reporter, events) = recording();
        let valid = verify_files(root.path(), &files, &CancelToken::new(), &reporter).unwrap();
        assert_eq!(valid.valid, [false, true, true, false, false, false]);
        assert_eq!(
            valid.reused_bytes,
            bytes.len() as u64,
            "the reused total is the scheduler's own count, not a second fold"
        );
        let events = events.lock().unwrap();
        let scanned: Vec<_> = events
            .iter()
            .filter_map(|event| event.verification_bytes)
            .collect();
        assert_eq!(scanned.first(), Some(&0));
        assert_eq!(
            scanned.last(),
            Some(&(4 * bytes.len() as u64)),
            "corrupt, truncated and missing files advance inspection without becoming reusable"
        );
        assert!(
            scanned.windows(2).all(|pair| pair[0] <= pair[1]),
            "concurrent readers must publish monotonic inspection progress"
        );
        assert!(events.windows(2).all(|pair| {
            pair[0].completed_bytes <= pair[1].completed_bytes
                && pair[0].completed_files <= pair[1].completed_files
        }));
        let last = events.last().unwrap();
        assert_eq!(last.verification_bytes, None, "the scan ends before repair");
        assert_eq!(
            (last.completed_bytes, last.completed_files),
            (bytes.len() as u64, 2)
        );
        assert!(
            events.iter().all(|event| event.current_file != "folder"),
            "a directory entry is never handed to a reader"
        );
    }

    #[test]
    fn large_file_reports_partial_inspection_before_becoming_reusable() {
        let root = tempfile::tempdir().unwrap();
        let bytes = vec![0x7b; 6 * 1024 * 1024 + 73];
        fs::write(root.path().join("large.pak"), &bytes).unwrap();
        let total_bytes = bytes.len() as u64;
        let cancel = CancelToken::new();
        let callback_cancel = cancel.clone();
        let events = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&events);
        let reporter = Reporter::new(
            DownloadProgress {
                total_bytes,
                ..Default::default()
            },
            move |snapshot| {
                if snapshot
                    .verification_bytes
                    .is_some_and(|bytes| bytes > 0 && bytes < total_bytes)
                {
                    callback_cancel.cancel();
                }
                sink.lock().unwrap().push(snapshot);
            },
        );

        let result = verify_with_workers(
            root.path(),
            &[entry("large.pak", &bytes)],
            &cancel,
            &reporter,
            1,
        );

        assert!(
            matches!(result, Err(VerificationError::Cancelled)),
            "inspection progress must be published while the file is still being hashed"
        );
        let events = events.lock().unwrap();
        let partial = events
            .iter()
            .find(|event| {
                event
                    .verification_bytes
                    .is_some_and(|bytes| bytes > 0 && bytes < total_bytes)
            })
            .expect("a large file must publish progress before its hash is complete");
        assert_eq!(partial.current_file, "large.pak");
        assert_eq!((partial.completed_bytes, partial.completed_files), (0, 0));
        assert!(
            events
                .iter()
                .all(|event| { event.completed_bytes == 0 && event.completed_files == 0 }),
            "cancelled inspection must never count the unfinished file as reusable"
        );
    }

    #[test]
    fn unsafe_names_are_rejected_before_any_read() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("secret"), b"unreadable").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), root.path().join("link")).unwrap();
        let reporter = silent();
        for name in ["../outside", "/absolute", ".bs-download/lock"] {
            assert!(matches!(
                verify_files(
                    root.path(),
                    &[entry(name, b"x")],
                    &CancelToken::new(),
                    &reporter
                ),
                Err(VerificationError::Install(InstallError::UnsafePath(_)))
            ));
        }
        #[cfg(unix)]
        assert!(matches!(
            verify_files(
                root.path(),
                &[entry("link/secret", b"unreadable")],
                &CancelToken::new(),
                &reporter
            ),
            Err(VerificationError::Install(InstallError::UnsafePath(_)))
        ));
    }

    #[test]
    fn readers_overlap_up_to_the_four_reader_ceiling() {
        let root = tempfile::tempdir().unwrap();
        let count = worker_limit();
        assert!((1..=4).contains(&count));
        let bytes = vec![7_u8; 64 * 1024];
        let files: Vec<_> = (0..count)
            .map(|index| {
                let name = format!("file-{index}");
                fs::write(root.path().join(&name), &bytes).unwrap();
                entry(&name, &bytes)
            })
            .collect();
        let overlap = Barrier::new(count);
        let active = AtomicUsize::new(0);
        let peak = AtomicUsize::new(0);
        let valid = schedule(
            &files,
            &CancelToken::new(),
            |file| confined_path(root.path(), file),
            |path, file: &Entry, cancel| {
                let running = active.fetch_add(1, Ordering::AcqRel) + 1;
                let _reader = Reader(&active);
                peak.fetch_max(running, Ordering::AcqRel);
                overlap.wait();
                install::verify_sha1_file(path, file.size(), file.sha1(), cancel)
            },
            |_, _, _| {},
            count,
        )
        .unwrap();
        assert!(valid.valid.iter().all(|valid| *valid));
        assert_eq!(peak.load(Ordering::Acquire), count);
        assert_eq!(active.load(Ordering::Acquire), 0);
        assert!(count <= MAX_WORKERS);
    }

    #[test]
    fn cancellation_joins_every_reader_and_skips_remaining_files() {
        let root = tempfile::tempdir().unwrap();
        let bytes = vec![3_u8; 1024];
        let files: Vec<_> = (0..8)
            .map(|index| {
                let name = format!("file-{index}");
                fs::write(root.path().join(&name), &bytes).unwrap();
                entry(&name, &bytes)
            })
            .collect();
        let cancel = CancelToken::new();
        let active = AtomicUsize::new(0);
        let started = AtomicUsize::new(0);
        let result = schedule(
            &files,
            &cancel,
            |file| confined_path(root.path(), file),
            |path, file: &Entry, inner: &CancelToken| {
                active.fetch_add(1, Ordering::AcqRel);
                let _reader = Reader(&active);
                started.fetch_add(1, Ordering::AcqRel);
                let valid = install::verify_sha1_file(path, file.size(), file.sha1(), inner)?;
                cancel.cancel();
                Ok(valid)
            },
            |_, _, _| {},
            1,
        );
        assert!(matches!(result, Err(ScheduleError::Cancelled)));
        assert_eq!(active.load(Ordering::Acquire), 0, "every reader is joined");
        assert_eq!(
            started.load(Ordering::Acquire),
            1,
            "cancellation stops the remaining files"
        );
    }

    #[test]
    fn error_and_panic_join_every_reader_and_stop_pending_files() {
        for panic in [false, true] {
            let active = AtomicUsize::new(0);
            let started = AtomicUsize::new(0);
            let overlap = Barrier::new(4);
            let result = schedule(
                &[Sized(1), Sized(1), Sized(1), Sized(1), Sized(1), Sized(1)],
                &CancelToken::new(),
                |_| Ok(()),
                |_, _, _| {
                    active.fetch_add(1, Ordering::AcqRel);
                    let _reader = Reader(&active);
                    started.fetch_add(1, Ordering::AcqRel);
                    overlap.wait();
                    if panic {
                        panic!("fixture reader failed");
                    }
                    Err("fixture read failure")
                },
                |_, _, _| {},
                4,
            );
            if panic {
                assert!(matches!(result, Err(ScheduleError::WorkerFailed)));
            } else {
                assert!(matches!(
                    result,
                    Err(ScheduleError::File("fixture read failure"))
                ));
            }
            assert_eq!(active.load(Ordering::Acquire), 0);
            assert_eq!(started.load(Ordering::Acquire), 4);
        }
    }

    #[test]
    fn scheduler_failures_stay_opaque_to_callers() {
        let overflow = schedule(
            &[Sized(u64::MAX), Sized(1)],
            &CancelToken::new(),
            |_| Ok::<_, ()>(()),
            |_, _, _| Ok(true),
            |_, _, _| {},
            1,
        );
        assert!(matches!(overflow, Err(ScheduleError::InvalidTotalSize)));
        let panic = schedule(
            &[Sized(1)],
            &CancelToken::new(),
            |_| Ok::<_, ()>(()),
            |_, _, _| Ok(true),
            |_, _, _| panic!("fixture callback failed"),
            1,
        );
        assert!(matches!(panic, Err(ScheduleError::WorkerFailed)));
        for error in [
            ScheduleError::<()>::WorkerFailed,
            ScheduleError::InvalidTotalSize,
            ScheduleError::InvalidFileCount,
        ] {
            let narrowed = match error {
                ScheduleError::Cancelled => VerificationError::Cancelled,
                ScheduleError::File(()) => VerificationError::SchedulerFailed,
                ScheduleError::WorkerFailed
                | ScheduleError::InvalidTotalSize
                | ScheduleError::InvalidFileCount => VerificationError::SchedulerFailed,
            };
            assert!(matches!(narrowed, VerificationError::SchedulerFailed));
        }
    }
}
