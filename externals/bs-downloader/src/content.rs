mod format;
mod manifest_cache;
mod verification;

pub use manifest_cache::CachedManifest;

use std::{
    collections::{HashSet, VecDeque},
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use crate::{
    install::{
        self, InstallError, PARTIAL_DIRECTORY, apply_permissions, checked_file_path,
        ensure_directory, reject_link_or_special_file, safe_relative_path,
    },
    transfer::{self, Cancelled, DownloadPhase, DownloadProgress, DownloadSummary, Reporter},
};
use reqwest::{Client, Url};
use sha1::{Digest, Sha1};
#[cfg(test)]
use std::sync::atomic::{AtomicBool, Ordering};
use thiserror::Error;
use tokio::sync::mpsc;

pub(crate) use crate::install::hex;
pub use crate::transfer::CancelToken;
use format::{Chunk, Manifest, ManifestFile, decode_chunk, parse_manifest, unpack_zip};

const MAX_MANIFEST_BYTES: usize = 128 * 1024 * 1024;
const MAX_CHUNK_BYTES: usize = 64 * 1024 * 1024;
const CHUNK_CONCURRENCY: usize = 16;
const FILE_PREFETCH_WINDOW: usize = 8;
pub struct DepotDownload {
    pub depot_id: u32,
    pub manifest_id: u64,
    pub request_code: u64,
    pub depot_key: [u8; 32],
    pub server: String,
    pub cdn_token: Option<String>,
    pub destination: PathBuf,
    pub cached_manifest: Option<CachedManifest>,
}

#[derive(Debug, Error)]
pub enum ContentError {
    #[error("steam.content.cancelled")]
    Cancelled,
    #[error("steam.content.network")]
    Network,
    #[error("{}", crate::message::format("steam.content.http", &[.0.to_string()]))]
    Http(u16),
    #[error("{}", crate::message::format("steam.content.invalid", std::slice::from_ref(.0)))]
    InvalidData(String),
    #[error("{}", crate::message::format("steam.content.unsafePath", std::slice::from_ref(.0)))]
    UnsafePath(String),
    #[error("{}", crate::message::format("steam.content.unsupportedSymlink", std::slice::from_ref(.0)))]
    UnsupportedSymlink(String),
    #[error("steam.content.locked")]
    AlreadyDownloading,
    #[error("{}", crate::message::format("steam.content.io", &[.0.to_string()]))]
    Io(#[from] std::io::Error),
}

impl From<Cancelled> for ContentError {
    fn from(_: Cancelled) -> Self {
        Self::Cancelled
    }
}

impl From<InstallError> for ContentError {
    fn from(error: InstallError) -> Self {
        match error {
            InstallError::Cancelled => Self::Cancelled,
            InstallError::UnsafePath(path) => Self::UnsafePath(path),
            InstallError::Io(error) => Self::Io(error),
        }
    }
}

#[derive(Clone)]
pub struct ContentClient {
    client: Client,
    #[cfg(test)]
    test_endpoint: Option<Url>,
}

type ChunkResult = Result<Vec<u8>, ContentError>;

impl ContentClient {
    pub fn new(client: Client) -> Self {
        Self {
            client,
            #[cfg(test)]
            test_endpoint: None,
        }
    }
    pub async fn cached_manifest(
        &self,
        destination: &Path,
        depot_id: u32,
        manifest_id: u64,
        key: &[u8; 32],
    ) -> Result<Option<CachedManifest>, ContentError> {
        let destination = destination.to_owned();
        let key = *key;
        tokio::task::spawn_blocking(move || {
            manifest_cache::load(&destination, depot_id, manifest_id, &key)
        })
        .await
        .map_err(|_| invalid("steam.content.manifestReadInterrupted"))?
    }
    pub async fn download_depot(
        &self,
        plan: &DepotDownload,
        cancel: &CancelToken,
        progress: impl Fn(DownloadProgress) + Send + Sync + 'static,
    ) -> Result<DownloadSummary, ContentError> {
        cancel.check()?;
        let reporter = Reporter::new(
            DownloadProgress {
                current_file: "steam.content.fetchingManifest".into(),
                ..Default::default()
            },
            progress,
        );
        let cached = match &plan.cached_manifest {
            Some(cached) => Some(cached.clone()),
            None => {
                self.cached_manifest(
                    &plan.destination,
                    plan.depot_id,
                    plan.manifest_id,
                    &plan.depot_key,
                )
                .await?
            }
        };
        cancel.check()?;
        let (manifest, archive) = if let Some(cached) = cached {
            (cached.manifest, None)
        } else {
            let manifest_path = if plan.request_code == 0 {
                format!("depot/{}/manifest/{}/5", plan.depot_id, plan.manifest_id)
            } else {
                format!(
                    "depot/{}/manifest/{}/5/{}",
                    plan.depot_id, plan.manifest_id, plan.request_code
                )
            };
            let zipped = self
                .fetch(
                    plan,
                    &manifest_path,
                    MAX_MANIFEST_BYTES,
                    cancel,
                    |received| {
                        reporter.update(|status| status.network_bytes += received);
                    },
                )
                .await?;
            let key = plan.depot_key;
            let manifest = cancel
                .spawn_blocking(move || {
                    let manifest_bytes = unpack_zip(&zipped, MAX_MANIFEST_BYTES)?;
                    let manifest = parse_manifest(&manifest_bytes, &key)?;
                    validate_manifest_files(&manifest.files)?;
                    Ok::<_, ContentError>((manifest, zipped))
                })
                .await
                .map_err(|_| invalid("steam.content.manifestParseInterrupted"))?;
            let (manifest, zipped) = manifest?;
            (Arc::new(manifest), Some(zipped))
        };
        if manifest.depot_id != plan.depot_id || manifest.manifest_id != plan.manifest_id {
            return Err(invalid("steam.content.manifestDepotMismatch"));
        }
        let total_bytes = manifest.files.iter().map(|file| file.size).sum();
        let total_files = u32::try_from(
            manifest
                .files
                .iter()
                .filter(|file| !file.is_directory())
                .count(),
        )
        .map_err(|_| invalid("steam.content.tooManyFiles"))?;
        reporter.update(|status| {
            status.total_bytes = total_bytes;
            status.total_files = total_files;
            status.phase = DownloadPhase::Preparing;
            status.current_file.clear();
        });

        let (requests, request_queue) = mpsc::unbounded_channel();
        let (deliveries, results) = mpsc::channel(CHUNK_CONCURRENCY);
        let disk = DiskInstall {
            destination: plan.destination.clone(),
            depot_id: plan.depot_id,
            manifest_id: plan.manifest_id,
            archive,
            manifest,
            cancel: cancel.clone(),
            reporter: Arc::clone(&reporter),
            requests,
            results,
        };
        let (reused_bytes, ()) = tokio::join!(
            cancel.spawn_blocking(move || disk.run()),
            transfer::pump_chunks(
                request_queue,
                deliveries,
                CHUNK_CONCURRENCY,
                cancel,
                |chunk| self.fetch_chunk(plan, chunk, cancel, &reporter),
            ),
        );
        let reused_bytes =
            reused_bytes.map_err(|_| invalid("steam.content.diskInstallationInterrupted"))??;
        Ok(reporter.summary(reused_bytes))
    }
    async fn fetch_chunk(
        &self,
        plan: &DepotDownload,
        chunk: Chunk,
        cancel: &CancelToken,
        reporter: &Reporter,
    ) -> ChunkResult {
        let path = format!("depot/{}/chunk/{}", plan.depot_id, hex(&chunk.sha));
        let key = plan.depot_key;
        let mut last_error = None;
        for attempt in 0..3 {
            cancel.check()?;
            reporter.update(|status| status.phase = DownloadPhase::Downloading);
            let fetched = self
                .fetch(plan, &path, MAX_CHUNK_BYTES, cancel, |received| {
                    reporter.update(|status| {
                        status.network_bytes += received;
                        status.content_bytes += received;
                    });
                })
                .await;
            match fetched {
                Ok(encrypted) => {
                    let expected = chunk.clone();
                    let decoded = cancel
                        .spawn_blocking(move || decode_chunk(&encrypted, &expected, &key))
                        .await
                        .map_err(|_| invalid("steam.content.chunkDecryptionInterrupted"))?;
                    match decoded {
                        Ok(bytes) => return Ok(bytes),
                        Err(error) => last_error = Some(error),
                    }
                }
                Err(error @ (ContentError::Cancelled | ContentError::Http(401 | 403 | 404))) => {
                    return Err(error);
                }
                Err(error) => last_error = Some(error),
            }
            if attempt < 2 {
                tokio::select! {
                    () = tokio::time::sleep(Duration::from_millis(250 * (attempt + 1))) => {}
                    () = cancel.cancelled() => return Err(ContentError::Cancelled),
                }
            }
        }
        Err(last_error.unwrap_or(ContentError::Network))
    }

    async fn fetch(
        &self,
        plan: &DepotDownload,
        path: &str,
        limit: usize,
        cancel: &CancelToken,
        mut on_bytes: impl FnMut(u64),
    ) -> Result<Vec<u8>, ContentError> {
        let url = content_url(plan, path)?;
        #[cfg(test)]
        let url = if let Some(endpoint) = &self.test_endpoint {
            let mut local = endpoint.join(path).expect("test URL");
            local.set_query(url.query());
            local
        } else {
            url
        };
        let operation = async {
            let mut response = self
                .client
                .get(url)
                .timeout(Duration::from_secs(45))
                .send()
                .await
                .map_err(|_| ContentError::Network)?;
            if !response.status().is_success() {
                return Err(ContentError::Http(response.status().as_u16()));
            }
            let advertised = response.content_length();
            if advertised.is_some_and(|size| size > limit as u64) {
                return Err(invalid("steam.content.cdnResponseTooLarge"));
            }
            let mut bytes = Vec::with_capacity(advertised.map_or(0, |size| size as usize));
            while let Some(chunk) = response.chunk().await.map_err(|_| ContentError::Network)? {
                on_bytes(chunk.len() as u64);
                cancel.check()?;
                if bytes.len().saturating_add(chunk.len()) > limit {
                    return Err(invalid("steam.content.cdnResponseTooLarge"));
                }
                bytes.extend_from_slice(&chunk);
            }
            Ok(bytes)
        };
        tokio::select! {
            result = operation => result,
            () = cancel.cancelled() => Err(ContentError::Cancelled),
        }
    }
}
struct DiskInstall {
    destination: PathBuf,
    depot_id: u32,
    manifest_id: u64,
    archive: Option<Vec<u8>>,
    manifest: Arc<Manifest>,
    cancel: CancelToken,
    reporter: Arc<Reporter>,
    requests: mpsc::UnboundedSender<Chunk>,
    results: mpsc::Receiver<ChunkResult>,
}

struct PreparedFile<'a> {
    file: &'a ManifestFile,
    relative: PathBuf,
    target: PathBuf,
    partial_path: PathBuf,
    partial: File,
    reusable: Vec<bool>,
}

impl DiskInstall {
    fn run(mut self) -> Result<u64, ContentError> {
        self.cancel.check()?;
        fs::create_dir_all(&self.destination)?;
        let root = fs::canonicalize(&self.destination)?;
        let _lock = install::lock_engine(&root)?.ok_or(ContentError::AlreadyDownloading)?;
        if let Some(archive) = self.archive.take() {
            self.cancel.check()?;
            manifest_cache::store(&root, self.depot_id, self.manifest_id, &archive)?;
        }
        let pending = Path::new(PARTIAL_DIRECTORY).join("pending.json");
        let identity = serde_json::json!({ "depot": self.depot_id.to_string(), "manifest": self.manifest_id.to_string() });
        install::write_cached_file(&root, &pending, identity.to_string().as_bytes())?;
        let partial_relative = PathBuf::from(PARTIAL_DIRECTORY)
            .join(self.depot_id.to_string())
            .join(self.manifest_id.to_string());
        let partial_root = ensure_directory(&root, &partial_relative)?;
        let manifest = Arc::clone(&self.manifest);
        let verified =
            verification::verify_files(&root, &manifest.files, &self.cancel, &self.reporter)?;
        let mut reused_bytes = verified.reused_bytes;
        let mut pending_directory: Option<PathBuf> = None;
        let mut ensured_parents: HashSet<PathBuf> = HashSet::new();
        let mut remaining = manifest.files.iter().enumerate();
        let mut prepared = VecDeque::new();
        loop {
            while prepared.len() < FILE_PREFETCH_WINDOW {
                let Some((index, file)) = remaining.next() else {
                    break;
                };
                self.cancel.check()?;
                let relative = safe_relative_path(&file.name)?;
                if file.is_directory() {
                    ensure_directory(&root, &relative)?;
                    ensured_parents.insert(relative);
                    continue;
                }
                let parent = relative.parent().unwrap_or(Path::new(""));
                if !ensured_parents.contains(parent) {
                    ensure_directory(&root, parent)?;
                    ensured_parents.insert(parent.to_path_buf());
                }
                let target = checked_file_path(&root, &relative)?;
                if verified.valid[index] {
                    apply_permissions(&target, is_executable(file))?;
                    continue;
                }
                prepared.push_back(self.prepare(&partial_root, file, relative, target)?);
            }
            let Some(next) = prepared.pop_front() else {
                break;
            };
            self.cancel.check()?;
            self.reporter.update(|status| {
                status.current_file.clone_from(&next.file.name);
            });
            let directory = next.target.parent().unwrap_or(&root).to_path_buf();
            reused_bytes += self.assemble(next, &root)?;
            if pending_directory.as_ref() != Some(&directory)
                && let Some(previous) = pending_directory.replace(directory)
            {
                install::sync_directory(&previous)?;
            }
            self.reporter.update(|status| status.completed_files += 1);
        }
        if let Some(directory) = pending_directory {
            install::sync_directory(&directory)?;
        }
        self.reporter.update(|status| {
            status.phase = DownloadPhase::Verifying;
            status.verification_bytes = Some(0);
        });
        let progress = Arc::clone(&self.reporter);
        let final_reporter = Reporter::new(DownloadProgress::default(), move |scan| {
            progress.update(|status| {
                status.verification_bytes =
                    Some(scan.verification_bytes.unwrap_or(scan.completed_bytes));
                status.current_file = scan.current_file;
            });
        });
        let final_scan =
            verification::verify_files(&root, &manifest.files, &self.cancel, &final_reporter)?;
        if manifest
            .files
            .iter()
            .zip(&final_scan.valid)
            .any(|(file, valid)| !file.is_directory() && !valid)
        {
            return Err(invalid("steam.content.installedHashMismatch"));
        }
        self.cancel.check()?;
        fs::remove_file(checked_file_path(&root, &pending)?)?;
        Ok(reused_bytes)
    }
    fn prepare<'a>(
        &self,
        partial_root: &Path,
        file: &'a ManifestFile,
        relative: PathBuf,
        target: PathBuf,
    ) -> Result<PreparedFile<'a>, ContentError> {
        let partial_name = format!("{}.part", hex(&Sha1::digest(file.name.as_bytes())));
        let partial_path = partial_root.join(partial_name);
        reject_link_or_special_file(&partial_path)?;
        let mut partial = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&partial_path)?;
        let existing = partial.metadata()?.len();
        partial.set_len(file.size)?;
        let mut reusable = vec![false; file.chunks.len()];
        let mut buffer = Vec::new();
        for (index, chunk) in file.chunks.iter().enumerate() {
            self.cancel.check()?;
            if chunk.offset + u64::from(chunk.original_size) > existing {
                continue;
            }
            buffer.clear();
            buffer.resize(chunk.original_size as usize, 0);
            partial.seek(SeekFrom::Start(chunk.offset))?;
            partial.read_exact(&mut buffer)?;
            reusable[index] = format::verify_chunk(&buffer, chunk).is_ok();
        }
        for (chunk, _) in file
            .chunks
            .iter()
            .zip(&reusable)
            .filter(|(_, reused)| !**reused)
        {
            self.cancel.check()?;
            if self.requests.send(chunk.clone()).is_err() {
                break;
            }
        }
        Ok(PreparedFile {
            file,
            relative,
            target,
            partial_path,
            partial,
            reusable,
        })
    }
    fn assemble(&mut self, prepared: PreparedFile<'_>, root: &Path) -> Result<u64, ContentError> {
        let PreparedFile {
            file,
            relative,
            target,
            partial_path,
            mut partial,
            reusable,
        } = prepared;
        let hash_while_writing = !reusable.contains(&true);
        let mut hasher = Sha1::new();
        let mut reused_bytes = 0;
        for (chunk, reused) in file.chunks.iter().zip(&reusable) {
            self.cancel.check()?;
            if *reused {
                reused_bytes += u64::from(chunk.original_size);
            } else {
                let bytes = self
                    .results
                    .blocking_recv()
                    .ok_or_else(|| invalid("steam.content.chunkDownloadInterrupted"))??;
                partial.seek(SeekFrom::Start(chunk.offset))?;
                partial.write_all(&bytes)?;
                if hash_while_writing {
                    hasher.update(&bytes);
                }
            }
            let size = u64::from(chunk.original_size);
            self.reporter
                .update(|status| status.completed_bytes += size);
        }
        self.cancel.check()?;
        partial.sync_all()?;
        drop(partial);
        let valid = if hash_while_writing {
            hasher.finalize()[..] == file.sha
        } else {
            verify_file(&partial_path, file, &self.cancel)?
        };
        if !valid {
            return Err(invalid("steam.content.assembledHashMismatch"));
        }
        apply_permissions(&partial_path, is_executable(file))?;
        checked_file_path(root, &relative)?;
        fs::rename(&partial_path, target)?;
        Ok(reused_bytes)
    }
}

fn content_url(plan: &DepotDownload, path: &str) -> Result<Url, ContentError> {
    if plan.server.is_empty() || plan.server.contains(['/', '?', '#', '@', '\\']) {
        return Err(invalid("steam.content.invalidCdnAddress"));
    }
    let mut url = Url::parse(&format!("https://{}/", plan.server))
        .map_err(|_| invalid("steam.content.invalidCdnAddress"))?;
    url.set_path(path);
    url.set_query(
        plan.cdn_token
            .as_deref()
            .map(|token| token.trim_start_matches('?')),
    );
    Ok(url)
}

fn invalid(reason: &str) -> ContentError {
    ContentError::InvalidData(reason.into())
}

fn is_executable(file: &ManifestFile) -> bool {
    file.flags & 32 != 0
}

fn validate_manifest_files(files: &[ManifestFile]) -> Result<(), ContentError> {
    let mut paths = HashSet::new();
    let mut total_size = 0_u64;
    for file in files {
        let path = safe_relative_path(&file.name)?;
        if !paths.insert(path.to_string_lossy().to_lowercase()) {
            return Err(invalid("steam.content.conflictingPaths"));
        }
        if file.flags & 512 != 0 || !file.link_target.is_empty() {
            return Err(ContentError::UnsupportedSymlink(file.name.clone()));
        }
        if file.is_directory() {
            if file.size != 0 || !file.chunks.is_empty() {
                return Err(invalid("steam.content.directoryContainsData"));
            }
            continue;
        }
        if file.sha.len() != 20 {
            return Err(invalid("steam.content.invalidFileChecksum"));
        }
        total_size = total_size
            .checked_add(file.size)
            .ok_or_else(|| invalid("steam.content.invalidDepotSize"))?;
        let mut offset = 0_u64;
        for chunk in &file.chunks {
            if chunk.sha.len() != 20
                || chunk.original_size == 0
                || chunk.original_size as usize > MAX_CHUNK_BYTES
                || chunk.compressed_size as usize > MAX_CHUNK_BYTES
                || chunk.offset != offset
            {
                return Err(invalid("steam.content.invalidChunkLayout"));
            }
            offset = offset
                .checked_add(u64::from(chunk.original_size))
                .ok_or_else(|| invalid("steam.content.invalidChunkSize"))?;
        }
        if offset != file.size {
            return Err(invalid("steam.content.missingChunks"));
        }
    }
    let files_only: HashSet<_> = files
        .iter()
        .filter(|file| !file.is_directory())
        .map(|file| {
            safe_relative_path(&file.name).map(|path| path.to_string_lossy().to_lowercase())
        })
        .collect::<Result<_, _>>()?;
    for file in files {
        let path = safe_relative_path(&file.name)?;
        if path
            .ancestors()
            .skip(1)
            .any(|parent| files_only.contains(&parent.to_string_lossy().to_lowercase()))
        {
            return Err(invalid("steam.content.fileUsedAsDirectory"));
        }
    }
    Ok(())
}

fn verify_file(
    path: &Path,
    expected: &ManifestFile,
    cancel: &CancelToken,
) -> Result<bool, ContentError> {
    Ok(install::verify_sha1_file(
        path,
        expected.size,
        &expected.sha,
        cancel,
    )?)
}

#[cfg(test)]
mod tests;
