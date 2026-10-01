use super::*;

fn disk_install(
    destination: &Path,
    files: Vec<ManifestFile>,
    cancel: &CancelToken,
) -> (
    DiskInstall,
    mpsc::UnboundedReceiver<ChunkRequest>,
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
    let (deliveries, results) = mpsc::channel(WRITE_QUEUE);
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
    // Neither a valid file nor a directory between two repairs should stop
    // requests for the next file. The empty file still needs publication.
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
        transfer::pump_chunks_unordered(
            requests,
            deliveries,
            CHUNK_REQUESTS,
            &cancel,
            |(place, chunk): ChunkRequest| {
                let first = &first;
                let second = &second;
                let payloads = &payloads;
                let future_started = &future_started;
                let observed = &observed;
                let fetched = &fetched;
                async move {
                    fetched.lock().unwrap().push(chunk.sha.clone());
                    if &chunk.sha == first {
                        // The old file-at-a-time scheduler cannot start file two
                        // while this first chunk is held, and fails this deadline.
                        tokio::time::timeout(Duration::from_secs(2), future_started.notified())
                            .await
                            .map_err(|_| ContentError::Network)?;
                    } else if &chunk.sha == second {
                        observed.store(true, Ordering::Release);
                        future_started.notify_one();
                    }
                    Ok((place, payloads.get(&chunk.sha).unwrap().clone()))
                }
            }
        ),
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
async fn a_later_file_is_published_while_the_first_file_waits_for_a_chunk() {
    let directory = tempfile::tempdir().unwrap();
    let first = b"first file";
    let second = b"second file";
    let files = vec![file("first.bin", &[first]), file("second.bin", &[second])];
    let cancel = CancelToken::new();
    let (disk, requests, deliveries, reporter) = disk_install(directory.path(), files, &cancel);
    let destination = directory.path();
    let (installed, ()) = tokio::join!(
        cancel.spawn_blocking(move || disk.run()),
        transfer::pump_chunks_unordered(
            requests,
            deliveries,
            CHUNK_REQUESTS,
            &cancel,
            |(place, _): ChunkRequest| async move {
                let bytes = if place.file == 0 {
                    tokio::time::timeout(Duration::from_secs(2), async {
                        while !destination.join("second.bin").exists() {
                            tokio::time::sleep(Duration::from_millis(5)).await;
                        }
                    })
                    .await
                    .map_err(|_| ContentError::Network)?;
                    assert!(!destination.join("first.bin").exists());
                    first.to_vec()
                } else {
                    second.to_vec()
                };
                Ok((place, bytes))
            },
        ),
    );
    assert_eq!(installed.unwrap().unwrap(), 0);
    assert_eq!(fs::read(destination.join("first.bin")).unwrap(), first);
    assert_eq!(fs::read(destination.join("second.bin")).unwrap(), second);
    assert_eq!(reporter.snapshot().completed_files, 2);
}

#[tokio::test]
async fn cancellation_bounds_prepared_files_and_resumes_each_verified_partial() {
    let directory = tempfile::tempdir().unwrap();
    // More files than may be prepared at once, with fewer chunks than the window.
    let pieces: Vec<_> = (0..PREPARED_FILES + 8)
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
    // A later file already has one valid partial chunk before prefetch begins.
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
    let reused = pieces[3][0].len() as u64;
    let result = client
        .download_depot(&plan(directory.path()), &cancel, move |status| {
            if status.completed_bytes > reused && !trigger.is_cancelled() {
                // The first chunk was written, but no replacement has been
                // published.
                *count.lock().unwrap() = Some(fs::read_dir(&counted_root).unwrap().count());
                trigger.cancel();
            }
        })
        .await;
    assert!(matches!(result, Err(ContentError::Cancelled)));
    assert_eq!(*partial_count.lock().unwrap(), Some(PREPARED_FILES));
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
    // The verified partial chunk, and the chunk written before cancellation.
    assert!(resumed.reused_bytes > reused);
    assert_eq!(resumed.completed_files, files.len() as u32);
    for (file, parts) in files.iter().zip(&pieces) {
        assert_eq!(
            fs::read(directory.path().join(&file.name)).unwrap(),
            parts.concat()
        );
    }
    let route = format!("/depot/42/chunk/{}", hex(&Sha1::digest(&pieces[3][0])));
    assert!(!fixture.requests.lock().unwrap().contains(&route));
}

#[tokio::test]
async fn a_closed_prefetch_queue_preserves_the_ordered_cdn_error() {
    let directory = tempfile::tempdir().unwrap();
    let files: Vec<_> = (0..10)
        .map(|index| file(&format!("{index:02}.bin"), &[b"new file content"]))
        .collect();
    let cancel = CancelToken::new();
    let (disk, requests, deliveries, _) = disk_install(directory.path(), files, &cancel);
    // A failed pump places its terminal result on the writer queue, then drops
    // the request receiver. Preparing a future file must preserve that error.
    drop(requests);
    deliveries.send(Err(ContentError::Http(403))).await.unwrap();
    drop(deliveries);
    let result = cancel.spawn_blocking(move || disk.run()).await.unwrap();
    assert!(matches!(result, Err(ContentError::Http(403))));
    assert!(!directory.path().join("00.bin").exists());
    assert!(install::lock_engine(directory.path()).unwrap().is_some());
}
