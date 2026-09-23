use std::{
    collections::HashMap,
    net::TcpListener,
    sync::{Arc, Mutex},
    thread,
};

use aes::cipher::{BlockCipherEncrypt, BlockModeEncrypt, KeyInit, KeyIvInit, block_padding::Pkcs7};
use prost::Message;

use super::format::{Chunk, steam_adler};
use super::*;

mod prefetch;

const KEY: [u8; 32] = [0x42; 32];

fn encrypt(bytes: &[u8]) -> Vec<u8> {
    let cipher = aes::Aes256::new((&KEY).into());
    let iv = [0x12; 16];
    let mut encrypted_iv = aes::cipher::Block::<aes::Aes256>::default();
    encrypted_iv.copy_from_slice(&iv);
    cipher.encrypt_block(&mut encrypted_iv);
    let mut output = encrypted_iv.to_vec();
    let mut body = bytes.to_vec();
    body.resize(bytes.len() + 16, 0);
    let encrypted = cbc::Encryptor::<aes::Aes256>::new((&KEY).into(), (&iv).into())
        .encrypt_padded::<Pkcs7>(&mut body, bytes.len())
        .unwrap();
    output.extend_from_slice(encrypted);
    output
}

fn zip(bytes: &[u8]) -> Vec<u8> {
    let mut encoder = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::fast());
    encoder.write_all(bytes).unwrap();
    let compressed = encoder.finish().unwrap();
    let crc = crc32fast::hash(bytes);
    let mut output = Vec::new();
    output.extend_from_slice(b"PK\x03\x04");
    for value in [20_u16, 0, 8, 0, 0] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    for value in [crc, compressed.len() as u32, bytes.len() as u32] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    output.extend_from_slice(&[1, 0, 0, 0, b'z']);
    output.extend_from_slice(&compressed);
    let central = output.len() as u32;
    output.extend_from_slice(b"PK\x01\x02");
    for value in [20_u16, 20, 0, 8, 0, 0] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    for value in [crc, compressed.len() as u32, bytes.len() as u32] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    for value in [1_u16, 0, 0, 0, 0] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    output.extend_from_slice(&[0; 8]);
    output.push(b'z');
    let central_size = output.len() as u32 - central;
    output.extend_from_slice(b"PK\x05\x06");
    for value in [0_u16, 0, 1, 1] {
        output.extend_from_slice(&value.to_le_bytes());
    }
    output.extend_from_slice(&central_size.to_le_bytes());
    output.extend_from_slice(&central.to_le_bytes());
    output.extend_from_slice(&0_u16.to_le_bytes());
    output
}

fn vzip(bytes: &[u8]) -> Vec<u8> {
    let mut lzma = Vec::new();
    lzma_rs::lzma_compress(&mut std::io::Cursor::new(bytes), &mut lzma).unwrap();
    let crc = crc32fast::hash(bytes);
    let mut output = b"VZa".to_vec();
    output.extend_from_slice(&crc.to_le_bytes());
    output.extend_from_slice(&lzma[..5]);
    output.extend_from_slice(&lzma[13..]);
    output.extend_from_slice(&crc.to_le_bytes());
    output.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
    output.extend_from_slice(b"zv");
    output
}

fn vzstd(bytes: &[u8]) -> Vec<u8> {
    assert!(bytes.len() < 256);
    let crc = crc32fast::hash(bytes);
    let mut output = b"VSZa".to_vec();
    output.extend_from_slice(&crc.to_le_bytes());
    output.extend_from_slice(&[0x28, 0xb5, 0x2f, 0xfd, 0x20, bytes.len() as u8]);
    let block_header = ((bytes.len() as u32) << 3) | 1;
    output.extend_from_slice(&block_header.to_le_bytes()[..3]);
    output.extend_from_slice(bytes);
    output.extend_from_slice(&crc.to_le_bytes());
    output.extend_from_slice(&(bytes.len() as u64).to_le_bytes());
    output.extend_from_slice(b"zsv");
    output
}

fn chunk(bytes: &[u8], offset: u64, compressed_size: usize) -> Chunk {
    Chunk {
        sha: Sha1::digest(bytes).to_vec(),
        adler: steam_adler(bytes),
        offset,
        original_size: bytes.len() as u32,
        compressed_size: compressed_size as u32,
    }
}

#[derive(Message)]
struct TestPayload {
    #[prost(message, repeated, tag = "1")]
    files: Vec<ManifestFile>,
}

#[derive(Message)]
struct TestMetadata {
    #[prost(uint32, tag = "1")]
    depot_id: u32,
    #[prost(uint64, tag = "2")]
    manifest_id: u64,
    #[prost(bool, tag = "4")]
    encrypted_names: bool,
    #[prost(uint32, tag = "8")]
    encrypted_crc: u32,
    #[prost(uint32, tag = "9")]
    clear_crc: u32,
}

fn manifest(files: Vec<ManifestFile>, encrypted_names: bool) -> Vec<u8> {
    manifest_version(files, encrypted_names, 99)
}

fn manifest_version(files: Vec<ManifestFile>, encrypted_names: bool, manifest_id: u64) -> Vec<u8> {
    let payload = TestPayload { files }.encode_to_vec();
    let mut crc = crc32fast::Hasher::new();
    crc.update(&(payload.len() as u32).to_le_bytes());
    crc.update(&payload);
    let crc = crc.finalize();
    let metadata = TestMetadata {
        depot_id: 42,
        manifest_id,
        encrypted_names,
        encrypted_crc: if encrypted_names { crc } else { 0 },
        clear_crc: if encrypted_names { 0 } else { crc },
    }
    .encode_to_vec();
    let mut output = Vec::new();
    for (magic, bytes) in [
        (0x71f6_17d0_u32, payload),
        (0x1f48_12be, metadata),
        (0x1b81_b817, Vec::new()),
    ] {
        output.extend_from_slice(&magic.to_le_bytes());
        output.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
        output.extend_from_slice(&bytes);
    }
    output.extend_from_slice(&0x32c4_15ab_u32.to_le_bytes());
    output
}

fn file(name: &str, pieces: &[&[u8]]) -> ManifestFile {
    let bytes = pieces.concat();
    let mut offset = 0;
    let chunks = pieces
        .iter()
        .map(|bytes| {
            let encrypted = encrypt(&zip(bytes));
            let info = chunk(bytes, offset, encrypted.len());
            offset += bytes.len() as u64;
            info
        })
        .collect();
    ManifestFile {
        name: name.into(),
        size: bytes.len() as u64,
        sha: Sha1::digest(&bytes).to_vec(),
        chunks,
        ..Default::default()
    }
}

#[test]
fn decrypts_all_three_steam_chunk_compression_envelopes_and_rejects_corruption() {
    let bytes = b"SteamPipe test chunk: UTF-8 \xc3\xa9\n";
    for compressed in [zip(bytes), vzip(bytes), vzstd(bytes)] {
        let encrypted = encrypt(&compressed);
        let expected = chunk(bytes, 0, encrypted.len());
        assert_eq!(decode_chunk(&encrypted, &expected, &KEY).unwrap(), bytes);
        let mut wrong = expected.clone();
        wrong.sha[0] ^= 1;
        assert!(decode_chunk(&encrypted, &wrong, &KEY).is_err());
        wrong = expected.clone();
        wrong.adler ^= 1;
        assert!(decode_chunk(&encrypted, &wrong, &KEY).is_err());
        assert!(decode_chunk(&encrypted, &expected, &[9; 32]).is_err());
    }
    assert_eq!(steam_adler(b"abc"), 0x024a0126);
}

#[test]
fn reads_encrypted_names_and_rejects_truncation_and_bad_manifest_crc() {
    use base64::Engine;
    let mut item = file("bin/game.exe", &[b"game"]);
    item.name = base64::engine::general_purpose::STANDARD.encode(encrypt(b"bin\\game.exe\0"));
    item.name.push('\n');
    let bytes = manifest(vec![item], true);
    let decoded = parse_manifest(&bytes, &KEY).unwrap();
    assert_eq!(decoded.files[0].name, "bin/game.exe");
    assert_eq!(decoded.depot_id, 42);
    for length in 0..bytes.len() {
        assert!(parse_manifest(&bytes[..length], &KEY).is_err());
    }
    let mut corrupt = bytes;
    corrupt[15] ^= 1;
    assert!(parse_manifest(&corrupt, &KEY).is_err());
}

#[test]
fn rejects_paths_symlinks_conflicts_and_chunk_gaps_before_installing() {
    for name in [
        "../escape",
        "/escape",
        "C:\\escape",
        "a/../../escape",
        "a/./b",
        "a\0b",
        ".bs-download/file",
        ".BS-DOWNLOAD-INSTALL.JSON",
        ".BS-DOWNLOAD-INSTALL.LOCK",
    ] {
        assert!(
            validate_manifest_files(&[file(name, &[b"x"])]).is_err(),
            "{name}"
        );
    }
    let mut link = file("link", &[]);
    link.flags = 512;
    link.link_target = "../../outside".into();
    assert!(matches!(
        validate_manifest_files(&[link]),
        Err(ContentError::UnsupportedSymlink(_))
    ));
    assert!(validate_manifest_files(&[file("A.exe", &[b"a"]), file("a.exe", &[b"b"])]).is_err());
    assert!(validate_manifest_files(&[file("a//b", &[b"a"]), file("a/b", &[b"b"])]).is_err());
    assert!(validate_manifest_files(&[file("bin", &[b"a"]), file("bin/game", &[b"b"])]).is_err());
    let mut gap = file("game", &[b"one", b"two"]);
    gap.chunks[1].offset += 1;
    assert!(validate_manifest_files(&[gap]).is_err());
}

#[test]
fn zip_limits_and_checksum_are_enforced() {
    let mut data = zip(b"verified content");
    assert!(unpack_zip(&data, 2).is_err());
    let length = data.len();
    data[length - 22 - 47 + 16] ^= 1;
    assert!(unpack_zip(&data, 100).is_err());
    for length in 0..31 {
        assert!(unpack_zip(&data[..length], 100).is_err());
    }
}

#[test]
#[ignore = "requires STEAMKIT_REFERENCE_DIRECTORY pointing to the upstream SteamKit checkout"]
fn decodes_upstream_reference_manifest_and_three_real_chunk_fixtures() {
    let checkout = PathBuf::from(
        std::env::var("STEAMKIT_REFERENCE_DIRECTORY").expect("SteamKit checkout path"),
    );
    let files = checkout.join("SteamKit2/Tests/Files");
    fn decode_hex(value: &str) -> Vec<u8> {
        value
            .as_bytes()
            .as_chunks::<2>()
            .0
            .iter()
            .map(|pair| u8::from_str_radix(std::str::from_utf8(pair).unwrap(), 16).unwrap())
            .collect()
    }
    let depot_440_key: [u8; 32] =
        decode_hex("44ce5c5297a415a1a6f69c856037a5a2fdd82cd474fa659edfb4d59b2abc55fc")
            .try_into()
            .unwrap();
    let manifest = fs::read(files.join("depot_440_1118032470228587934.manifest")).unwrap();
    let manifest = parse_manifest(&manifest, &depot_440_key).unwrap();
    assert_eq!(manifest.depot_id, 440);
    assert_eq!(manifest.manifest_id, 1118032470228587934);
    assert_eq!(manifest.files.len(), 7);
    assert!(
        manifest
            .files
            .iter()
            .any(|file| file.name == "bin/dxsupport.cfg")
    );
    validate_manifest_files(&manifest.files).unwrap();
    for (depot, sha, key, adler, compressed_size, original_size) in [
        (
            440,
            "bac8e2657470b2eb70d6ddcd6c07004be8738697",
            "44ce5c5297a415a1a6f69c856037a5a2fdd82cd474fa659edfb4d59b2abc55fc",
            2130218374,
            320,
            544,
        ),
        (
            232250,
            "7b8567d9b3c09295cdbf4978c32b348d8e76c750",
            "e5f6aed55e9ece429e56b813fbf6bfe924f3cf72972fdbd0571ffcad9f2f7daa",
            2894626744,
            304,
            798,
        ),
        (
            3441461,
            "9e72678e305540630a665b93e1463bc3983eb55a",
            "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
            3753325726,
            176,
            156,
        ),
    ] {
        let input = fs::read(files.join(format!("depot_{depot}_chunk_{sha}.bin"))).unwrap();
        let chunk = Chunk {
            sha: decode_hex(sha),
            adler,
            offset: 0,
            compressed_size,
            original_size,
        };
        let key: [u8; 32] = decode_hex(key).try_into().unwrap();
        let bytes = decode_chunk(&input, &chunk, &key).unwrap();
        assert_eq!(bytes.len(), original_size as usize);
        assert_eq!(hex(&Sha1::digest(&bytes)), sha);
    }
}

struct CdnFixture {
    endpoint: Url,
    requests: Arc<Mutex<Vec<String>>>,
    stop: Arc<AtomicBool>,
    thread: Option<thread::JoinHandle<()>>,
}

impl CdnFixture {
    fn new(routes: HashMap<String, Vec<u8>>) -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let endpoint = Url::parse(&format!("http://{}/", listener.local_addr().unwrap())).unwrap();
        let requests = Arc::new(Mutex::new(Vec::new()));
        let stop = Arc::new(AtomicBool::new(false));
        let thread_requests = Arc::clone(&requests);
        let thread_stop = Arc::clone(&stop);
        let worker = thread::spawn(move || {
            'connections: while !thread_stop.load(Ordering::Relaxed) {
                let (mut stream, _) = match listener.accept() {
                    Ok(connection) => connection,
                    Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(Duration::from_millis(5));
                        continue;
                    }
                    Err(error) => panic!("fixture accept: {error}"),
                };
                stream.set_nonblocking(false).unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                stream
                    .set_write_timeout(Some(Duration::from_secs(3)))
                    .unwrap();
                let mut request = Vec::new();
                let mut buffer = [0; 1024];
                while !request.windows(4).any(|window| window == b"\r\n\r\n") {
                    let count = match stream.read(&mut buffer) {
                        Ok(count) => count,
                        Err(error)
                            if matches!(
                                error.kind(),
                                std::io::ErrorKind::ConnectionAborted
                                    | std::io::ErrorKind::ConnectionReset
                            ) =>
                        {
                            continue 'connections;
                        }
                        Err(error) => panic!("fixture read: {error}"),
                    };
                    if count == 0 {
                        continue 'connections;
                    }
                    request.extend_from_slice(&buffer[..count]);
                }
                let text = String::from_utf8(request).unwrap();
                let path = text.split_whitespace().nth(1).unwrap_or("").to_string();
                thread_requests.lock().unwrap().push(path.clone());
                let (code, bytes) = routes
                    .get(&path)
                    .map_or((404, &b"missing"[..]), |bytes| (200, bytes.as_slice()));
                let sent = write!(
                    stream,
                    "HTTP/1.1 {code} OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    bytes.len()
                )
                .and_then(|_| stream.write_all(bytes));
                if let Err(error) = sent {
                    assert!(
                        matches!(
                            error.kind(),
                            std::io::ErrorKind::BrokenPipe
                                | std::io::ErrorKind::ConnectionAborted
                                | std::io::ErrorKind::ConnectionReset
                        ),
                        "fixture write: {error}"
                    );
                }
            }
        });
        Self {
            endpoint,
            requests,
            stop,
            thread: Some(worker),
        }
    }

    fn client(&self) -> ContentClient {
        ContentClient {
            client: Client::new(),
            test_endpoint: Some(self.endpoint.clone()),
        }
    }
}

impl Drop for CdnFixture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(worker) = self.thread.take()
            && let Err(failure) = worker.join()
            && !thread::panicking()
        {
            std::panic::resume_unwind(failure);
        }
    }
}

#[test]
fn cdn_fixture_waits_for_delayed_request_headers() {
    let fixture = CdnFixture::new(HashMap::from([("/delayed".into(), b"response".to_vec())]));
    let address = fixture.endpoint.socket_addrs(|| None).unwrap()[0];
    let mut connection = std::net::TcpStream::connect(address).unwrap();
    connection
        .set_read_timeout(Some(Duration::from_secs(3)))
        .unwrap();
    thread::sleep(Duration::from_millis(100));
    let mut response = String::new();
    let result = connection
        .write_all(b"GET /delayed HTTP/1.1\r\nHost: fixture\r\n\r\n")
        .and_then(|()| connection.read_to_string(&mut response));
    let requests = fixture.requests.lock().unwrap().clone();
    drop(connection);
    drop(fixture);
    result.unwrap();
    assert_eq!(requests, ["/delayed"]);
    assert_eq!(
        response,
        "HTTP/1.1 200 OK\r\nContent-Length: 8\r\nConnection: close\r\n\r\nresponse"
    );
}

fn plan(destination: &Path) -> DepotDownload {
    DepotDownload {
        depot_id: 42,
        manifest_id: 99,
        request_code: 123,
        depot_key: KEY,
        server: "cdn.steamcontent.com".into(),
        cdn_token: None,
        destination: destination.into(),
        cached_manifest: None,
    }
}

fn routes(item: ManifestFile, pieces: &[&[u8]]) -> HashMap<String, Vec<u8>> {
    let mut routes = HashMap::from([(
        "/depot/42/manifest/99/5/123".into(),
        zip(&manifest(vec![item], false)),
    )]);
    for bytes in pieces {
        routes.insert(
            format!("/depot/42/chunk/{}", hex(&Sha1::digest(bytes))),
            encrypt(&zip(bytes)),
        );
    }
    routes
}

#[tokio::test]
async fn installs_and_reuses_steam_empty_file_with_zero_hash() {
    let directory = tempfile::tempdir().unwrap();
    let mut empty = file("empty.dat", &[]);
    empty.sha = vec![0; 20];
    let fixture = CdnFixture::new(routes(empty, &[]));
    let client = fixture.client();
    let plan = plan(directory.path());
    for _ in 0..2 {
        let result = client
            .download_depot(&plan, &CancelToken::new(), |_| {})
            .await
            .unwrap();
        assert_eq!(result.completed_files, 1);
        assert_eq!(
            fs::metadata(directory.path().join("empty.dat"))
                .unwrap()
                .len(),
            0
        );
    }
}

#[tokio::test]
async fn final_verification_detects_disk_changes_before_completion() {
    let directory = tempfile::tempdir().unwrap();
    let target = directory.path().join("game.exe");
    let fixture = CdnFixture::new(routes(file("game.exe", &[b"correct"]), &[b"correct"]));
    let mutated = AtomicBool::new(false);
    let result = fixture
        .client()
        .download_depot(
            &plan(directory.path()),
            &CancelToken::new(),
            move |status| {
                if status.phase == DownloadPhase::Verifying && !mutated.swap(true, Ordering::SeqCst)
                {
                    fs::write(&target, b"corrupt").unwrap();
                }
            },
        )
        .await;
    assert!(
        matches!(result, Err(ContentError::InvalidData(reason)) if reason == "steam.content.installedHashMismatch")
    );
    assert!(directory.path().join(".bs-download/pending.json").exists());
}

#[test]
fn zero_digest_normalization_is_limited_to_empty_steam_files() {
    let mut item = file("nonempty", &[b"content"]);
    item.sha = vec![0; 20];
    let parsed = parse_manifest(&manifest(vec![item], false), &KEY).unwrap();
    assert_eq!(parsed.files[0].sha, [0; 20]);
}

#[tokio::test]
async fn downloads_atomically_and_reuses_verified_files_on_next_invocation() {
    let directory = tempfile::tempdir().unwrap();
    let pieces: &[&[u8]] = &[b"first chunk", b"second chunk"];
    let item = file("bin/game.exe", pieces);
    let routes = routes(item, pieces);
    let fixture = CdnFixture::new(routes);
    let client = fixture.client();
    let events = Arc::new(Mutex::new(Vec::new()));
    let result = client
        .download_depot(&plan(directory.path()), &CancelToken::new(), {
            let events = Arc::clone(&events);
            move |p| events.lock().unwrap().push(p)
        })
        .await
        .unwrap();
    assert_eq!(
        fs::read(directory.path().join("bin/game.exe")).unwrap(),
        pieces.concat()
    );
    assert_eq!(result.completed_files, 1);
    assert_eq!(result.reused_bytes, 0);
    assert!(result.content_bytes > 0);
    assert_eq!(fixture.requests.lock().unwrap().len(), 3);
    let last = events.lock().unwrap().last().unwrap().clone();
    assert_eq!(last.completed_bytes, last.total_bytes);
    assert_eq!(last.completed_files, last.total_files);
    let installed_path = directory.path().join("bin/game.exe");
    let original_metadata = fs::metadata(&installed_path).unwrap();
    let request_count_before_check = fixture.requests.lock().unwrap().len();
    let check_events = Arc::new(Mutex::new(Vec::new()));
    let resumed = client
        .download_depot(&plan(directory.path()), &CancelToken::new(), {
            let check_events = Arc::clone(&check_events);
            move |event| check_events.lock().unwrap().push(event)
        })
        .await
        .unwrap();
    assert_eq!(resumed.reused_bytes, pieces.concat().len() as u64);
    assert_eq!(resumed.content_bytes, 0);
    let requests = fixture.requests.lock().unwrap();
    let verification_requests = &requests[request_count_before_check..];
    assert!(
        verification_requests.is_empty(),
        "a current cached manifest must avoid all CDN requests for unchanged files"
    );
    assert_eq!(
        verification_requests
            .iter()
            .filter(|path| path.contains("/chunk/"))
            .count(),
        0
    );
    assert_eq!(
        resumed.downloaded_bytes, 0,
        "a cached manifest and valid local files require no CDN bytes"
    );
    let verified_metadata = fs::metadata(&installed_path).unwrap();
    assert_eq!(
        verified_metadata.modified().unwrap(),
        original_metadata.modified().unwrap(),
        "verified files must not be rewritten"
    );
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        assert_eq!(
            verified_metadata.ino(),
            original_metadata.ino(),
            "verified files must not be replaced"
        );
    }
    assert_eq!(fs::read(installed_path).unwrap(), pieces.concat());
    let check_events = check_events.lock().unwrap();
    let last = check_events.last().unwrap();
    assert_eq!(last.completed_bytes, resumed.total_bytes);
    assert_eq!(last.network_bytes, 0);
    assert!(
        check_events
            .iter()
            .any(|event| event.phase == DownloadPhase::Preparing)
    );
    assert!(
        check_events
            .iter()
            .any(|event| event.phase == DownloadPhase::Verifying)
    );
    assert!(
        check_events
            .iter()
            .all(|event| event.phase != DownloadPhase::Downloading && event.content_bytes == 0),
        "disk verification and manifest requests must never be presented as game downloads"
    );
}

#[tokio::test]
async fn invalid_cache_is_refetched_and_a_new_manifest_installs_its_new_content() {
    let directory = tempfile::tempdir().unwrap();
    let old = b"installed version";
    let new = b"updated version";
    let mut responses = routes(file("game.exe", &[old]), &[old]);
    responses.insert(
        "/depot/42/manifest/100/5/123".into(),
        zip(&manifest_version(
            vec![file("game.exe", &[new])],
            false,
            100,
        )),
    );
    responses.insert(
        format!("/depot/42/chunk/{}", hex(&Sha1::digest(new))),
        encrypt(&zip(new)),
    );
    let fixture = CdnFixture::new(responses);
    let client = fixture.client();
    let cancel = CancelToken::new();
    client
        .download_depot(&plan(directory.path()), &cancel, |_| {})
        .await
        .unwrap();
    let cached_path = directory.path().join(".bs-download/manifests/42/99.zip");
    fs::write(&cached_path, b"truncated cache").unwrap();
    let before = fixture.requests.lock().unwrap().len();
    let repaired = client
        .download_depot(&plan(directory.path()), &cancel, |_| {})
        .await
        .unwrap();
    assert_eq!(repaired.content_bytes, 0);
    assert!(repaired.downloaded_bytes > 0);
    assert_eq!(
        &fixture.requests.lock().unwrap()[before..],
        ["/depot/42/manifest/99/5/123"]
    );
    assert!(
        client
            .cached_manifest(directory.path(), 42, 99, &KEY)
            .await
            .unwrap()
            .is_some()
    );
    let mut updated_plan = plan(directory.path());
    updated_plan.manifest_id = 100;
    let before = fixture.requests.lock().unwrap().len();
    let updated = client
        .download_depot(&updated_plan, &cancel, |_| {})
        .await
        .unwrap();
    assert!(updated.content_bytes > 0);
    assert_eq!(fs::read(directory.path().join("game.exe")).unwrap(), new);
    assert_eq!(
        fixture.requests.lock().unwrap()[before],
        "/depot/42/manifest/100/5/123"
    );
}

#[tokio::test]
async fn cached_manifest_still_hashes_and_repairs_corrupt_or_missing_files() {
    let directory = tempfile::tempdir().unwrap();
    let good = b"keep this game file";
    let repair = b"correct game content";
    let missing = b"restore missing file";
    let mut responses = routes(file("good.bin", &[good]), &[good]);
    responses.insert(
        "/depot/42/manifest/99/5/123".into(),
        zip(&manifest(
            vec![
                file("good.bin", &[good]),
                file("bad.bin", &[repair]),
                file("missing.bin", &[missing]),
            ],
            false,
        )),
    );
    for bytes in [&repair[..], &missing[..]] {
        responses.insert(
            format!("/depot/42/chunk/{}", hex(&Sha1::digest(bytes))),
            encrypt(&zip(bytes)),
        );
    }
    let fixture = CdnFixture::new(responses);
    let client = fixture.client();
    let cancel = CancelToken::new();
    client
        .download_depot(&plan(directory.path()), &cancel, |_| {})
        .await
        .unwrap();
    let good_path = directory.path().join("good.bin");
    let original = fs::metadata(&good_path).unwrap();
    let bad_path = directory.path().join("bad.bin");
    let bad_metadata = fs::metadata(&bad_path).unwrap();
    let mut corrupted = repair.to_vec();
    corrupted[0] ^= 1;
    fs::write(&bad_path, corrupted).unwrap();
    File::options()
        .write(true)
        .open(&bad_path)
        .unwrap()
        .set_modified(bad_metadata.modified().unwrap())
        .unwrap();
    fs::remove_file(directory.path().join("missing.bin")).unwrap();
    let mut cached_plan = plan(directory.path());
    cached_plan.cached_manifest = client
        .cached_manifest(directory.path(), 42, 99, &KEY)
        .await
        .unwrap();
    assert!(cached_plan.cached_manifest.is_some());
    cached_plan.request_code = 0;
    let before = fixture.requests.lock().unwrap().len();
    let events = Arc::new(Mutex::new(Vec::new()));
    let result = client
        .download_depot(&cached_plan, &cancel, {
            let events = Arc::clone(&events);
            move |event| events.lock().unwrap().push(event)
        })
        .await
        .unwrap();
    let requests = fixture.requests.lock().unwrap();
    let requested = &requests[before..];
    assert_eq!(requested.len(), 2);
    assert!(requested.iter().all(|path| path.contains("/chunk/")));
    assert_eq!(result.reused_bytes, good.len() as u64);
    assert_eq!(result.downloaded_bytes, result.content_bytes);
    assert_eq!(
        result.total_bytes,
        (good.len() + repair.len() + missing.len()) as u64
    );
    assert_eq!(fs::read(bad_path).unwrap(), repair);
    assert_eq!(
        fs::read(directory.path().join("missing.bin")).unwrap(),
        missing
    );
    assert_eq!(
        fs::metadata(good_path).unwrap().modified().unwrap(),
        original.modified().unwrap()
    );
    let events = events.lock().unwrap();
    assert!(
        events
            .windows(2)
            .all(|pair| pair[0].completed_bytes <= pair[1].completed_bytes)
    );
    assert_eq!(events.last().unwrap().completed_bytes, result.total_bytes);
}

#[tokio::test]
async fn missing_or_corrupt_files_report_downloads_only_when_fetching_game_chunks() {
    for corrupt_existing_file in [false, true] {
        let directory = tempfile::tempdir().unwrap();
        let bytes = b"correct game content";
        let target = directory.path().join("game.exe");
        if corrupt_existing_file {
            fs::write(&target, b"damaged game content").unwrap();
        }
        let routes = routes(file("game.exe", &[bytes]), &[bytes]);
        let manifest_bytes = routes["/depot/42/manifest/99/5/123"].len() as u64;
        let chunk_bytes = routes
            .iter()
            .filter(|(path, _)| path.contains("/chunk/"))
            .map(|(_, bytes)| bytes.len() as u64)
            .sum::<u64>();
        let fixture = CdnFixture::new(routes);
        let events = Arc::new(Mutex::new(Vec::new()));
        let result = fixture
            .client()
            .download_depot(&plan(directory.path()), &CancelToken::new(), {
                let events = Arc::clone(&events);
                move |event| events.lock().unwrap().push(event)
            })
            .await
            .unwrap();
        assert_eq!(fs::read(target).unwrap(), bytes);
        assert_eq!(result.content_bytes, chunk_bytes);
        assert_eq!(result.downloaded_bytes, manifest_bytes + chunk_bytes);
        assert_eq!(
            fixture
                .requests
                .lock()
                .unwrap()
                .iter()
                .filter(|path| path.contains("/chunk/"))
                .count(),
            1
        );
        let events = events.lock().unwrap();
        assert_eq!(events.first().unwrap().phase, DownloadPhase::Preparing);
        assert!(
            events
                .iter()
                .filter(|event| event.phase == DownloadPhase::Verifying)
                .all(|event| event.completed_bytes == event.total_bytes),
            "Final verification must start only after all game bytes are installed"
        );
        assert!(
            events
                .iter()
                .any(|event| event.phase == DownloadPhase::Downloading)
        );
        assert!(
            events
                .iter()
                .filter(|event| event.phase == DownloadPhase::Preparing)
                .all(|event| event.content_bytes == 0)
        );
        assert_eq!(events.last().unwrap().phase, DownloadPhase::Verifying);
        assert_eq!(events.last().unwrap().content_bytes, chunk_bytes);
        assert!(
            events
                .windows(2)
                .all(|pair| pair[0].content_bytes <= pair[1].content_bytes)
        );
    }
}

#[tokio::test]
async fn cancellation_keeps_original_and_resumes_verified_partial_chunks() {
    let directory = tempfile::tempdir().unwrap();
    let pieces: &[&[u8]] = &[b"first chunk", b"second chunk"];
    let item = file("game.exe", pieces);
    let fixture = CdnFixture::new(routes(item, pieces));
    let original = b"old working version";
    fs::write(directory.path().join("game.exe"), original).unwrap();
    let cancel = CancelToken::new();
    let trigger = cancel.clone();
    let error = fixture
        .client()
        .download_depot(&plan(directory.path()), &cancel, move |status| {
            if status.completed_bytes > 0 {
                trigger.cancel();
            }
        })
        .await
        .unwrap_err();
    assert!(matches!(error, ContentError::Cancelled));
    let pending = directory.path().join(".bs-download/pending.json");
    let identity: serde_json::Value = serde_json::from_slice(&fs::read(&pending).unwrap()).unwrap();
    assert_eq!(identity["manifest"], "99");
    assert_eq!(
        fs::read(directory.path().join("game.exe")).unwrap(),
        original
    );
    let resumed = fixture
        .client()
        .download_depot(&plan(directory.path()), &CancelToken::new(), |_| {})
        .await
        .unwrap();
    assert_eq!(resumed.reused_bytes, pieces[0].len() as u64);
    assert!(
        !pending.exists(),
        "successful repair clears the resume marker"
    );
    assert_eq!(
        fs::read(directory.path().join("game.exe")).unwrap(),
        pieces.concat()
    );
    let chunk_one = format!("/depot/42/chunk/{}", hex(&Sha1::digest(pieces[0])));
    assert_eq!(
        fixture
            .requests
            .lock()
            .unwrap()
            .iter()
            .filter(|path| **path == chunk_one)
            .count(),
        1
    );
}

#[cfg(unix)]
#[tokio::test]
async fn existing_parent_symlink_cannot_redirect_writes_outside_destination() {
    let directory = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    std::os::unix::fs::symlink(outside.path(), directory.path().join("bin")).unwrap();
    let fixture = CdnFixture::new(routes(file("bin/game.exe", &[b"game"]), &[b"game"]));
    let result = fixture
        .client()
        .download_depot(&plan(directory.path()), &CancelToken::new(), |_| {})
        .await;
    assert!(matches!(result, Err(ContentError::UnsafePath(_))));
    assert!(!outside.path().join("game.exe").exists());
    assert_eq!(fixture.requests.lock().unwrap().len(), 1);
}

#[tokio::test]
async fn traversal_manifest_does_not_create_destination() {
    let parent = tempfile::tempdir().unwrap();
    let destination = parent.path().join("install");
    let fixture = CdnFixture::new(routes(file("../escaped", &[b"game"]), &[b"game"]));
    let result = fixture
        .client()
        .download_depot(&plan(&destination), &CancelToken::new(), |_| {})
        .await;
    assert!(matches!(result, Err(ContentError::UnsafePath(_))));
    assert!(!destination.exists());
    assert!(!parent.path().join("escaped").exists());
}
