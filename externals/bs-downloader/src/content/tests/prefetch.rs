use super::*;

fn disk_install(
    destination: &Path,
    files: Vec<ManifestFile>,
    cancel: &CancelToken,
) -> (
    DiskInstall,
    mpsc::UnboundedReceiver<Chunk>,
    mpsc::Sender<ChunkResult>,
    Arc<Reporter>,
) {
    let reporter = Reporter::new(
        DownloadProgress {
            total_bytes: files.iter().map(|file| file.size).sum(),
            total_files: files.iter().filter(|file| !file.is_directory()).count() as u32,
            ..Default::default()
        },
        |_| {},
    );
    let (requests, receiver) = mpsc::unbounded_channel();
    let (deliveries, results) = mpsc::channel(CHUNK_CONCURRENCY);
    let disk = DiskInstall {
        destination: destination.into(),
        depot_id: 42,
        manifest_id: 99,
        archive: None,
        manifest: Arc::new(Manifest {
            depot_id: 42,
            manifest_id: 99,
            files,
        }),
        cancel: cancel.clone(),
        reporter: Arc::clone(&reporter),
        requests,
        results,
    };
    (disk, receiver, deliveries, reporter)
}

#[tokio::test]
async fn fetches_a_future_file_before_the_first_finishes_and_refills_the_window() {
    let directory = tempfile::tempdir().unwrap();
    let contents: Vec<_> = (0..12)
        .map(|index| format!("unique contents of file {index}").into_bytes())
        .collect();
    let mut files: Vec<_> = contents
        .iter()
        .enumerate()
        .map(|(index, bytes)| file(&format!("data/{index:02}.bin"), &[bytes]))
        .collect();
    let first = files[0].chunks[0].sha.clone();
    let second = files[1].chunks[0].sha.clone();
    let payloads: HashMap<_, _> = files
        .iter()
        .zip(&contents)
        .map(|(file, bytes)| (file.chunks[0].sha.clone(), bytes.clone()))
        .collect();
    let valid = b"already installed";
    fs::create_dir(directory.path().join("data")).unwrap();
    fs::write(directory.path().join("data/valid.bin"), valid).unwrap();
    files.insert(1, file("data/valid.bin", &[valid]));
    files.insert(
        2,
        ManifestFile {
            name: "data".into(),
            flags: 64,
            ..Default::default()
        },
    );
    files.push(file("data/empty.bin", &[]));
    let cancel = CancelToken::new();
    let (disk, requests, deliveries, reporter) = disk_install(directory.path(), files, &cancel);
    let future_started = tokio::sync::Notify::new();
    let observed = AtomicBool::new(false);
    let fetched = Mutex::new(Vec::new());
    let (installed, ()) = tokio::join!(
        cancel.spawn_blocking(move || disk.run()),
        transfer::pump_chunks(requests, deliveries, CHUNK_CONCURRENCY, &cancel, |chunk| {
            let first = &first;
            let second = &second;
            let payloads = &payloads;
            let future_started = &future_started;
            let observed = &observed;
            let fetched = &fetched;
            async move {
                fetched.lock().unwrap().push(chunk.sha.clone());
                if &chunk.sha == first {
                    tokio::time::timeout(Duration::from_secs(2), future_started.notified())
                        .await
                        .map_err(|_| ContentError::Network)?;
                } else if &chunk.sha == second {
                    observed.store(true, Ordering::Release);
                    future_started.notify_one();
                }
                Ok(payloads.get(&chunk.sha).unwrap().clone())
            }
        }),
    );
    assert_eq!(installed.unwrap().unwrap(), valid.len() as u64);
    assert!(observed.load(Ordering::Acquire));
    for (index, bytes) in contents.iter().enumerate() {
        assert_eq!(
            fs::read(directory.path().join(format!("data/{index:02}.bin"))).unwrap(),
            *bytes
        );
    }
    assert!(directory.path().join("data/empty.bin").is_file());
    assert_eq!(
        fs::read(directory.path().join("data/valid.bin")).unwrap(),
        valid
    );
    assert_eq!(fetched.lock().unwrap().len(), contents.len());
    let status = reporter.snapshot();
    assert_eq!(status.completed_files, 14);
    assert_eq!(status.completed_bytes, status.total_bytes);
}

#[tokio::test]
async fn cancellation_bounds_prepared_files_and_resumes_each_verified_partial() {
    let directory = tempfile::tempdir().unwrap();
    let pieces: Vec<_> = (0..10)
        .map(|index| {
            [
                format!("first chunk of file {index}").into_bytes(),
                format!("second chunk of file {index}").into_bytes(),
            ]
        })
        .collect();
    let files: Vec<_> = pieces
        .iter()
        .enumerate()
        .map(|(index, parts)| file(&format!("{index:02}.bin"), &[&parts[0], &parts[1]]))
        .collect();
    let mut responses = HashMap::from([(
        "/depot/42/manifest/99/5/123".into(),
        zip(&manifest(files.clone(), false)),
    )]);
    for bytes in pieces.iter().flatten() {
        responses.insert(
            format!("/depot/42/chunk/{}", hex(&Sha1::digest(bytes))),
            encrypt(&zip(bytes)),
        );
    }
    let original = b"old working version";
    for file in &files {
        fs::write(directory.path().join(&file.name), original).unwrap();
    }
    let partial_root = directory.path().join(PARTIAL_DIRECTORY).join("42/99");
    fs::create_dir_all(&partial_root).unwrap();
    let reused_path = partial_root.join(format!(
        "{}.part",
        hex(&Sha1::digest(files[3].name.as_bytes()))
    ));
    fs::write(reused_path, &pieces[3][0]).unwrap();
    let fixture = CdnFixture::new(responses);
    let client = fixture.client();
    let cancel = CancelToken::new();
    let trigger = cancel.clone();
    let partial_count = Arc::new(Mutex::new(None));
    let count = Arc::clone(&partial_count);
    let counted_root = partial_root.clone();
    let result = client
        .download_depot(&plan(directory.path()), &cancel, move |status| {
            if status.completed_bytes > 0 && !trigger.is_cancelled() {
                *count.lock().unwrap() = Some(fs::read_dir(&counted_root).unwrap().count());
                trigger.cancel();
            }
        })
        .await;
    assert!(matches!(result, Err(ContentError::Cancelled)));
    assert_eq!(*partial_count.lock().unwrap(), Some(FILE_PREFETCH_WINDOW));
    for file in &files {
        assert_eq!(
            fs::read(directory.path().join(&file.name)).unwrap(),
            original
        );
    }
    assert!(install::lock_engine(directory.path()).unwrap().is_some());
    let resumed = client
        .download_depot(&plan(directory.path()), &CancelToken::new(), |_| {})
        .await
        .unwrap();
    assert_eq!(
        resumed.reused_bytes,
        (pieces[0][0].len() + pieces[3][0].len()) as u64
    );
    assert_eq!(resumed.completed_files, files.len() as u32);
    for (file, parts) in files.iter().zip(&pieces) {
        assert_eq!(
            fs::read(directory.path().join(&file.name)).unwrap(),
            parts.concat()
        );
    }
    let requests = fixture.requests.lock().unwrap();
    for (bytes, expected_requests) in [(&pieces[0][0], 1), (&pieces[3][0], 0)] {
        let route = format!("/depot/42/chunk/{}", hex(&Sha1::digest(bytes)));
        assert_eq!(
            requests.iter().filter(|request| **request == route).count(),
            expected_requests
        );
    }
}

#[tokio::test]
async fn a_closed_prefetch_queue_preserves_the_ordered_cdn_error() {
    let directory = tempfile::tempdir().unwrap();
    let files: Vec<_> = (0..10)
        .map(|index| file(&format!("{index:02}.bin"), &[b"new file content"]))
        .collect();
    let cancel = CancelToken::new();
    let (disk, requests, deliveries, _) = disk_install(directory.path(), files, &cancel);
    drop(requests);
    deliveries.send(Err(ContentError::Http(403))).await.unwrap();
    drop(deliveries);
    let result = cancel.spawn_blocking(move || disk.run()).await.unwrap();
    assert!(matches!(result, Err(ContentError::Http(403))));
    assert!(!directory.path().join("00.bin").exists());
    assert!(install::lock_engine(directory.path()).unwrap().is_some());
}
