use std::io::{Cursor, Read, Write};

use aes::{
    Aes256,
    cipher::{BlockCipherDecrypt, BlockModeDecrypt, KeyInit, KeyIvInit, block_padding::Pkcs7},
};
use base64::{Engine, engine::general_purpose::STANDARD};
use prost::Message;
use sha1::{Digest, Sha1};

use super::{ContentError, MAX_CHUNK_BYTES, invalid};

const PAYLOAD_MAGIC: u32 = 0x71f6_17d0;
const METADATA_MAGIC: u32 = 0x1f48_12be;
const SIGNATURE_MAGIC: u32 = 0x1b81_b817;
const END_MAGIC: u32 = 0x32c4_15ab;

pub(super) struct Manifest {
    pub depot_id: u32,
    pub manifest_id: u64,
    pub files: Vec<ManifestFile>,
}

#[derive(Clone, Message)]
pub(super) struct ManifestFile {
    #[prost(string, tag = "1")]
    pub name: String,
    #[prost(uint64, tag = "2")]
    pub size: u64,
    #[prost(uint32, tag = "3")]
    pub flags: u32,
    #[prost(bytes = "vec", tag = "4")]
    pub name_sha: Vec<u8>,
    #[prost(bytes = "vec", tag = "5")]
    pub sha: Vec<u8>,
    #[prost(message, repeated, tag = "6")]
    pub chunks: Vec<Chunk>,
    #[prost(string, tag = "7")]
    pub link_target: String,
}

impl ManifestFile {
    pub fn is_directory(&self) -> bool {
        self.flags & 64 != 0
    }
}

#[derive(Clone, Message)]
pub(super) struct Chunk {
    #[prost(bytes = "vec", tag = "1")]
    pub sha: Vec<u8>,
    #[prost(fixed32, tag = "2")]
    pub adler: u32,
    #[prost(uint64, tag = "3")]
    pub offset: u64,
    #[prost(uint32, tag = "4")]
    pub original_size: u32,
    #[prost(uint32, tag = "5")]
    pub compressed_size: u32,
}

#[derive(Message)]
struct Payload {
    #[prost(message, repeated, tag = "1")]
    files: Vec<ManifestFile>,
}

#[derive(Message)]
struct Metadata {
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

pub(super) fn parse_manifest(data: &[u8], key: &[u8; 32]) -> Result<Manifest, ContentError> {
    let mut cursor = 0_usize;
    let mut payload: Option<&[u8]> = None;
    let mut metadata = None;
    let mut signature_seen = false;
    loop {
        let magic = u32_at(data, cursor)?;
        cursor += 4;
        if magic == END_MAGIC {
            if cursor != data.len() {
                return Err(invalid("steam.format.trailingManifestData"));
            }
            break;
        }
        let length = u32_at(data, cursor)? as usize;
        cursor += 4;
        let section = slice(data, cursor, length)?;
        cursor += length;
        match magic {
            PAYLOAD_MAGIC if payload.is_none() => payload = Some(section),
            METADATA_MAGIC if metadata.is_none() => {
                metadata = Some(
                    Metadata::decode(section)
                        .map_err(|_| invalid("steam.format.invalidProtobufMetadata"))?,
                );
            }
            SIGNATURE_MAGIC if !signature_seen => signature_seen = true,
            _ => return Err(invalid("steam.format.invalidManifestSection")),
        }
    }
    let payload = payload.ok_or_else(|| invalid("steam.format.inventoryMissing"))?;
    let metadata = metadata.ok_or_else(|| invalid("steam.format.metadataMissing"))?;
    if !signature_seen {
        return Err(invalid("steam.format.signatureMissing"));
    }
    let expected_crc = if metadata.encrypted_names {
        metadata.encrypted_crc
    } else {
        metadata.clear_crc
    };
    if expected_crc != 0 {
        let mut hasher = crc32fast::Hasher::new();
        hasher.update(&(payload.len() as u32).to_le_bytes());
        hasher.update(payload);
        if hasher.finalize() != expected_crc {
            return Err(invalid("steam.format.invalidManifestCrc"));
        }
    }
    let mut payload =
        Payload::decode(payload).map_err(|_| invalid("steam.format.invalidProtobufInventory"))?;
    for file in &mut payload.files {
        if metadata.encrypted_names {
            file.name = decrypt_name(&file.name, key)?;
            if !file.link_target.is_empty() {
                file.link_target = decrypt_name(&file.link_target, key)?;
            }
        }
        file.name = file.name.replace('\\', "/");
        file.chunks.sort_by_key(|chunk| chunk.offset);
        if !file.is_directory() && file.size == 0 && file.chunks.is_empty() && file.sha == [0; 20] {
            file.sha = Sha1::digest([]).to_vec();
        }
    }
    Ok(Manifest {
        depot_id: metadata.depot_id,
        manifest_id: metadata.manifest_id,
        files: payload.files,
    })
}

fn decrypt_name(name: &str, key: &[u8; 32]) -> Result<String, ContentError> {
    let encoded: Vec<u8> = name
        .bytes()
        .filter(|byte| !byte.is_ascii_whitespace())
        .collect();
    let encrypted = STANDARD
        .decode(encoded)
        .map_err(|_| invalid("steam.format.invalidEncryptedFileName"))?;
    let mut bytes = decrypt(&encrypted, key)?;
    if bytes.last() == Some(&0) {
        bytes.pop();
    }
    String::from_utf8(bytes).map_err(|_| invalid("steam.format.invalidUtf8FileName"))
}

fn decrypt(data: &[u8], key: &[u8; 32]) -> Result<Vec<u8>, ContentError> {
    if data.len() < 32 || !data.len().is_multiple_of(16) {
        return Err(invalid("steam.format.invalidAesBlockSize"));
    }
    let aes = Aes256::new(key.into());
    let mut iv = aes::cipher::Block::<Aes256>::default();
    iv.copy_from_slice(&data[..16]);
    aes.decrypt_block(&mut iv);
    let mut plaintext = data[16..].to_vec();
    let length = cbc::Decryptor::<Aes256>::new(key.into(), &iv)
        .decrypt_padded::<Pkcs7>(&mut plaintext)
        .map_err(|_| invalid("steam.format.decryptionFailed"))?
        .len();
    plaintext.truncate(length);
    Ok(plaintext)
}

pub(super) fn decode_chunk(
    encrypted: &[u8],
    expected: &Chunk,
    key: &[u8; 32],
) -> Result<Vec<u8>, ContentError> {
    if encrypted.len() > MAX_CHUNK_BYTES || expected.original_size as usize > MAX_CHUNK_BYTES {
        return Err(invalid("steam.format.chunkTooLarge"));
    }
    if expected.compressed_size != 0 && encrypted.len() != expected.compressed_size as usize {
        return Err(invalid("steam.format.invalidCdnChunkSize"));
    }
    let compressed = decrypt(encrypted, key)?;
    let output = if compressed.starts_with(b"VZa") {
        unpack_vzip(&compressed, expected.original_size as usize)?
    } else if compressed.starts_with(b"VSZa") {
        unpack_vzstd(&compressed, expected.original_size as usize)?
    } else if compressed.starts_with(b"PK\x03\x04") {
        unpack_zip(&compressed, expected.original_size as usize)?
    } else {
        return Err(invalid("steam.format.unknownCompression"));
    };
    verify_chunk(&output, expected)?;
    Ok(output)
}

pub(super) fn verify_chunk(bytes: &[u8], expected: &Chunk) -> Result<(), ContentError> {
    if bytes.len() != expected.original_size as usize
        || steam_adler(bytes) != expected.adler
        || Sha1::digest(bytes)[..] != expected.sha
    {
        return Err(invalid("steam.format.invalidChunkChecksum"));
    }
    Ok(())
}
pub(super) fn steam_adler(bytes: &[u8]) -> u32 {
    let (mut a, mut b) = (0_u32, 0_u32);
    for block in bytes.chunks(5552) {
        for &byte in block {
            a += u32::from(byte);
            b += a;
        }
        a %= 65521;
        b %= 65521;
    }
    (b << 16) | a
}
pub(super) fn unpack_zip(data: &[u8], limit: usize) -> Result<Vec<u8>, ContentError> {
    let first = data.len().saturating_sub(65535 + 22);
    let end = (first..data.len().saturating_sub(21))
        .rev()
        .find(|&position| data.get(position..position + 4) == Some(b"PK\x05\x06"))
        .ok_or_else(|| invalid("steam.format.zipDirectoryMissing"))?;
    if u16_at(data, end + 4)? != 0
        || u16_at(data, end + 6)? != 0
        || u16_at(data, end + 8)? != 1
        || u16_at(data, end + 10)? != 1
        || end + 22 + usize::from(u16_at(data, end + 20)?) != data.len()
    {
        return Err(invalid("steam.format.zipFileCount"));
    }
    let central_length = u32_at(data, end + 12)? as usize;
    let central = u32_at(data, end + 16)? as usize;
    if central.checked_add(central_length) != Some(end) || slice(data, central, 4)? != b"PK\x01\x02"
    {
        return Err(invalid("steam.format.invalidZipDirectory"));
    }
    let flags = u16_at(data, central + 8)?;
    let method = u16_at(data, central + 10)?;
    let crc = u32_at(data, central + 16)?;
    let compressed_size = u32_at(data, central + 20)? as usize;
    let original_size = u32_at(data, central + 24)? as usize;
    let central_name_len = usize::from(u16_at(data, central + 28)?);
    let central_extra_len = usize::from(u16_at(data, central + 30)?);
    let central_comment_len = usize::from(u16_at(data, central + 32)?);
    let local = u32_at(data, central + 42)? as usize;
    if flags & 1 != 0
        || original_size > limit
        || compressed_size > data.len()
        || central_length != 46 + central_name_len + central_extra_len + central_comment_len
        || slice(data, local, 4)? != b"PK\x03\x04"
        || u16_at(data, local + 6)? != flags
        || u16_at(data, local + 8)? != method
    {
        return Err(invalid("steam.format.invalidZipHeader"));
    }
    let local_name_len = usize::from(u16_at(data, local + 26)?);
    let local_extra_len = usize::from(u16_at(data, local + 28)?);
    let payload_start = local + 30 + local_name_len + local_extra_len;
    if payload_start
        .checked_add(compressed_size)
        .is_none_or(|end| end > central)
    {
        return Err(invalid("steam.format.invalidZipSizes"));
    }
    let compressed = slice(data, payload_start, compressed_size)?;
    let output = match method {
        0 => compressed.to_vec(),
        8 => read_limited(flate2::read::DeflateDecoder::new(compressed), original_size)?,
        _ => return Err(invalid("steam.format.unsupportedZipCompression")),
    };
    if output.len() != original_size || crc32fast::hash(&output) != crc {
        return Err(invalid("steam.format.invalidZipChecksum"));
    }
    Ok(output)
}

fn unpack_vzip(data: &[u8], expected: usize) -> Result<Vec<u8>, ContentError> {
    if data.len() < 22 || !data.ends_with(b"zv") {
        return Err(invalid("steam.format.invalidVzipEnvelope"));
    }
    let footer = data.len() - 10;
    let crc = u32_at(data, footer)?;
    let original_size = u32_at(data, footer + 4)? as usize;
    let dictionary_size = u32_at(data, 8)? as usize;
    if original_size != expected || dictionary_size > MAX_CHUNK_BYTES {
        return Err(invalid("steam.format.invalidVzipDictionary"));
    }
    let mut lzma = Vec::with_capacity(data.len());
    lzma.extend_from_slice(&data[7..12]);
    lzma.extend_from_slice(&(original_size as u64).to_le_bytes());
    lzma.extend_from_slice(&data[12..footer]);
    let options = lzma_rs::decompress::Options {
        memlimit: Some(MAX_CHUNK_BYTES),
        ..Default::default()
    };
    let mut output = LimitedWriter {
        bytes: Vec::with_capacity(expected),
        limit: expected,
    };
    lzma_rs::lzma_decompress_with_options(&mut Cursor::new(lzma), &mut output, &options)
        .map_err(|_| invalid("steam.format.lzmaFailed"))?;
    if output.bytes.len() != expected || crc32fast::hash(&output.bytes) != crc {
        return Err(invalid("steam.format.invalidVzipChecksum"));
    }
    Ok(output.bytes)
}

fn unpack_vzstd(data: &[u8], expected: usize) -> Result<Vec<u8>, ContentError> {
    if data.len() < 23 || !data.ends_with(b"zsv") {
        return Err(invalid("steam.format.invalidVzstdEnvelope"));
    }
    let footer = data.len() - 15;
    let crc = u32_at(data, footer)?;
    let original_size = u32_at(data, footer + 4)? as usize;
    if original_size != expected || u32_at(data, 4)? != crc {
        return Err(invalid("steam.format.invalidVzstdChecksum"));
    }
    let decoder = ruzstd::decoding::StreamingDecoder::new_with_max_window_size(
        &data[8..footer],
        MAX_CHUNK_BYTES as u64,
    )
    .map_err(|_| invalid("steam.format.invalidZstandardHeader"))?;
    let output = read_limited(decoder, expected)?;
    if output.len() != expected || crc32fast::hash(&output) != crc {
        return Err(invalid("steam.format.invalidZstandardChecksum"));
    }
    Ok(output)
}

fn read_limited(reader: impl Read, limit: usize) -> Result<Vec<u8>, ContentError> {
    let mut output = Vec::new();
    reader
        .take(limit as u64 + 1)
        .read_to_end(&mut output)
        .map_err(|_| invalid("steam.format.invalidCompressedData"))?;
    if output.len() > limit {
        return Err(invalid("steam.format.decompressedDataTooLarge"));
    }
    Ok(output)
}

struct LimitedWriter {
    bytes: Vec<u8>,
    limit: usize,
}
impl Write for LimitedWriter {
    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
        if self.bytes.len().saturating_add(bytes.len()) > self.limit {
            return Err(std::io::Error::other("steam.format.lzmaOutputTooLarge"));
        }
        self.bytes.extend_from_slice(bytes);
        Ok(bytes.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

fn slice(data: &[u8], offset: usize, size: usize) -> Result<&[u8], ContentError> {
    let end = offset
        .checked_add(size)
        .ok_or_else(|| invalid("steam.format.invalidBlockSize"))?;
    data.get(offset..end)
        .ok_or_else(|| invalid("steam.format.truncatedBlock"))
}
fn u16_at(data: &[u8], offset: usize) -> Result<u16, ContentError> {
    let bytes: [u8; 2] = slice(data, offset, 2)?
        .try_into()
        .map_err(|_| invalid("steam.format.truncatedInteger"))?;
    Ok(u16::from_le_bytes(bytes))
}
fn u32_at(data: &[u8], offset: usize) -> Result<u32, ContentError> {
    let bytes: [u8; 4] = slice(data, offset, 4)?
        .try_into()
        .map_err(|_| invalid("steam.format.truncatedInteger"))?;
    Ok(u32::from_le_bytes(bytes))
}
