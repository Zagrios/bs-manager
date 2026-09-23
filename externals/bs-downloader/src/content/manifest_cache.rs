use std::{
    path::{Path, PathBuf},
    sync::Arc,
};

use crate::install::{self, PARTIAL_DIRECTORY};

use super::{
    ContentError, MAX_MANIFEST_BYTES,
    format::{Manifest, parse_manifest, unpack_zip},
    invalid, validate_manifest_files,
};
#[derive(Clone)]
pub struct CachedManifest {
    pub(super) manifest: Arc<Manifest>,
}

pub(super) fn load(
    destination: &Path,
    depot_id: u32,
    manifest_id: u64,
    key: &[u8; 32],
) -> Result<Option<CachedManifest>, ContentError> {
    let relative = relative_path(depot_id, manifest_id);
    let Some(archive) = install::read_cached_file(destination, &relative, MAX_MANIFEST_BYTES)?
    else {
        return Ok(None);
    };
    let validated = (|| {
        let bytes = unpack_zip(&archive, MAX_MANIFEST_BYTES)?;
        let manifest = parse_manifest(&bytes, key)?;
        if manifest.depot_id != depot_id || manifest.manifest_id != manifest_id {
            return Err(invalid("steam.cache.manifestDepotMismatch"));
        }
        validate_manifest_files(&manifest.files)?;
        Ok(CachedManifest {
            manifest: Arc::new(manifest),
        })
    })();
    match validated {
        Ok(manifest) => Ok(Some(manifest)),
        Err(
            ContentError::InvalidData(_)
            | ContentError::UnsafePath(_)
            | ContentError::UnsupportedSymlink(_),
        ) => Ok(None),
        Err(error) => Err(error),
    }
}
pub(super) fn store(
    destination: &Path,
    depot_id: u32,
    manifest_id: u64,
    archive: &[u8],
) -> Result<(), ContentError> {
    if archive.len() > MAX_MANIFEST_BYTES {
        return Err(invalid("steam.cache.manifestTooLarge"));
    }
    install::write_cached_file(destination, &relative_path(depot_id, manifest_id), archive)?;
    Ok(())
}

fn relative_path(depot_id: u32, manifest_id: u64) -> PathBuf {
    PathBuf::from(PARTIAL_DIRECTORY)
        .join("manifests")
        .join(depot_id.to_string())
        .join(format!("{manifest_id}.zip"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use aes::cipher::{
        BlockCipherEncrypt, BlockModeEncrypt, KeyInit, KeyIvInit, block_padding::Pkcs7,
    };
    use base64::{Engine, engine::general_purpose::STANDARD};
    use prost::Message;
    use std::fs::{self, File};

    const KEY: [u8; 32] = [0x42; 32];

    #[derive(Message)]
    struct Payload {
        #[prost(message, repeated, tag = "1")]
        files: Vec<super::super::format::ManifestFile>,
    }
    #[derive(Message)]
    struct Metadata {
        #[prost(uint32, tag = "1")]
        depot: u32,
        #[prost(uint64, tag = "2")]
        manifest: u64,
        #[prost(bool, tag = "4")]
        encrypted_names: bool,
    }

    fn archive(depot: u32, manifest: u64, filename: &str) -> Vec<u8> {
        let iv = [0x12; 16];
        let mut name = filename.as_bytes().to_vec();
        name.push(0);
        let name_len = name.len();
        name.resize(name_len + 16, 0);
        let name = cbc::Encryptor::<aes::Aes256>::new((&KEY).into(), (&iv).into())
            .encrypt_padded::<Pkcs7>(&mut name, name_len)
            .unwrap();
        let mut encrypted_iv = aes::cipher::Block::<aes::Aes256>::default();
        encrypted_iv.copy_from_slice(&iv);
        aes::Aes256::new((&KEY).into()).encrypt_block(&mut encrypted_iv);
        let mut encrypted_name = encrypted_iv.to_vec();
        encrypted_name.extend_from_slice(name);
        let file = super::super::format::ManifestFile {
            name: STANDARD.encode(encrypted_name),
            sha: vec![
                0xda, 0x39, 0xa3, 0xee, 0x5e, 0x6b, 0x4b, 0x0d, 0x32, 0x55, 0xbf, 0xef, 0x95, 0x60,
                0x18, 0x90, 0xaf, 0xd8, 0x07, 0x09,
            ],
            ..Default::default()
        };
        let payload = Payload { files: vec![file] }.encode_to_vec();
        let metadata = Metadata {
            depot,
            manifest,
            encrypted_names: true,
        }
        .encode_to_vec();
        let mut data = Vec::new();
        for (magic, bytes) in [
            (0x71f6_17d0_u32, payload),
            (0x1f48_12be, metadata),
            (0x1b81_b817, Vec::new()),
        ] {
            data.extend_from_slice(&magic.to_le_bytes());
            data.extend_from_slice(&(bytes.len() as u32).to_le_bytes());
            data.extend_from_slice(&bytes);
        }
        data.extend_from_slice(&0x32c4_15ab_u32.to_le_bytes());
        stored_zip(&data)
    }

    fn stored_zip(data: &[u8]) -> Vec<u8> {
        let crc = crc32fast::hash(data);
        let mut zip = Vec::new();
        zip.extend_from_slice(b"PK\x03\x04");
        for value in [20_u16, 0, 0, 0, 0] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        for value in [crc, data.len() as u32, data.len() as u32] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        zip.extend_from_slice(&[1, 0, 0, 0, b'm']);
        zip.extend_from_slice(data);
        let central = zip.len() as u32;
        zip.extend_from_slice(b"PK\x01\x02");
        for value in [20_u16, 20, 0, 0, 0, 0] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        for value in [crc, data.len() as u32, data.len() as u32] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        for value in [1_u16, 0, 0, 0, 0] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        zip.extend_from_slice(&[0; 8]);
        zip.push(b'm');
        let central_len = zip.len() as u32 - central;
        zip.extend_from_slice(b"PK\x05\x06");
        for value in [0_u16, 0, 1, 1] {
            zip.extend_from_slice(&value.to_le_bytes());
        }
        zip.extend_from_slice(&central_len.to_le_bytes());
        zip.extend_from_slice(&central.to_le_bytes());
        zip.extend_from_slice(&0_u16.to_le_bytes());
        zip
    }

    #[test]
    fn caches_original_encrypted_archive_and_returns_validated_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let bytes = archive(42, 99, "game.exe");
        store(directory.path(), 42, 99, &bytes).unwrap();
        let cached = load(directory.path(), 42, 99, &KEY).unwrap().unwrap();
        assert_eq!(cached.manifest.files[0].name, "game.exe");
        assert_eq!(
            fs::read(directory.path().join(relative_path(42, 99))).unwrap(),
            bytes
        );
        assert!(
            !bytes
                .windows(b"game.exe".len())
                .any(|window| window == b"game.exe")
        );
        assert!(load(directory.path(), 42, 100, &KEY).unwrap().is_none());
    }

    #[test]
    fn malformed_mismatched_or_unsafe_cached_manifests_are_misses() {
        let directory = tempfile::tempdir().unwrap();
        let valid = archive(42, 99, "game.exe");
        let mut bad_crc = valid.clone();
        bad_crc[40] ^= 1;
        for bytes in [
            vec![1, 2, 3],
            bad_crc,
            valid[..valid.len() / 2].to_vec(),
            archive(42, 100, "game.exe"),
            archive(43, 99, "game.exe"),
            archive(42, 99, "../escape"),
        ] {
            store(directory.path(), 42, 99, &bytes).unwrap();
            assert!(load(directory.path(), 42, 99, &KEY).unwrap().is_none());
        }
        store(directory.path(), 42, 99, &valid).unwrap();
        assert!(load(directory.path(), 42, 99, &[0; 32]).unwrap().is_none());
        let file = File::options()
            .write(true)
            .open(directory.path().join(relative_path(42, 99)))
            .unwrap();
        file.set_len(MAX_MANIFEST_BYTES as u64 + 1).unwrap();
        assert!(load(directory.path(), 42, 99, &KEY).unwrap().is_none());
    }

    #[test]
    fn cache_miss_does_not_create_installation_and_snapshot_survives_disk_changes() {
        let directory = tempfile::tempdir().unwrap();
        let absent = directory.path().join("absent");
        assert!(load(&absent, 42, 99, &KEY).unwrap().is_none());
        assert!(!absent.exists());
        store(directory.path(), 42, 99, &archive(42, 99, "game.exe")).unwrap();
        let snapshot = load(directory.path(), 42, 99, &KEY).unwrap().unwrap();
        fs::write(
            directory.path().join(relative_path(42, 99)),
            b"corrupted after load",
        )
        .unwrap();
        assert_eq!(snapshot.manifest.files[0].name, "game.exe");
        assert!(load(directory.path(), 42, 99, &KEY).unwrap().is_none());
    }

    #[cfg(unix)]
    #[test]
    fn symlink_cache_locations_are_rejected_for_load_and_store() {
        let directory = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), directory.path().join(PARTIAL_DIRECTORY))
            .unwrap();
        assert!(matches!(
            load(directory.path(), 42, 99, &KEY),
            Err(ContentError::UnsafePath(_))
        ));
        assert!(matches!(
            store(directory.path(), 42, 99, &archive(42, 99, "game.exe")),
            Err(ContentError::UnsafePath(_))
        ));
        assert!(fs::read_dir(outside.path()).unwrap().next().is_none());
    }

    #[cfg(unix)]
    #[test]
    fn cache_file_symlinks_and_hardlinks_cannot_redirect_atomic_replacement() {
        for symlink in [false, true] {
            let directory = tempfile::tempdir().unwrap();
            let outside = tempfile::tempdir().unwrap();
            let archive = archive(42, 99, "game.exe");
            let external_file = outside.path().join("outside.zip");
            fs::write(&external_file, &archive).unwrap();
            let relative = relative_path(42, 99);
            fs::create_dir_all(directory.path().join(relative.parent().unwrap())).unwrap();
            let cache_path = directory.path().join(relative);
            if symlink {
                std::os::unix::fs::symlink(&external_file, &cache_path).unwrap();
            } else {
                fs::hard_link(&external_file, &cache_path).unwrap();
            }
            assert!(matches!(
                load(directory.path(), 42, 99, &KEY),
                Err(ContentError::UnsafePath(_))
            ));
            assert!(matches!(
                store(directory.path(), 42, 99, &archive),
                Err(ContentError::UnsafePath(_))
            ));
            assert_eq!(fs::read(external_file).unwrap(), archive);
        }
    }
}
