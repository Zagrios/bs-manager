# bs-downloader

BSManager's Rust Steam downloader. It downloads the requested manifest of Beat
Saber's Windows depot, including when BSManager runs on Linux with Proton. It does
not select the latest Steam branch or require Steam, SteamCMD or .NET to be installed.
Steam still checks the account's access to the depot and manifest.

## Build

`assets/scripts/bs-downloader.exe` is committed as a release build, like BSManager's
other Windows executables. Starting or building BSManager on Windows uses this
binary without compiling Rust.

`pnpm run build-rust-scripts` compiles with `--release --locked` and copies the binary
to `assets/scripts`. Run it after changing the downloader and include the updated
Windows executable in the commit.
Rust 1.93.1, a C toolchain and CMake are required for compilation. `Cargo.lock` is
committed.

On Linux, build the downloader before the first `pnpm start` or `pnpm run build`
and after Rust changes. The Linux binary remains generated per architecture;
the CI workflows build it explicitly before packaging or running binary tests.

Windows uses the native Rust MSVC toolchain. Linux builds use musl for x86-64 or
ARM64, with rustls and bundled certificate roots, avoiding dependencies on the
host's glibc or OpenSSL versions. For an Ubuntu build host:

```sh
sudo apt-get install build-essential musl-tools cmake
rustup target add x86_64-unknown-linux-musl
pnpm run build-rust-scripts
```

For ARM64, use an ARM64 build host and `aarch64-unknown-linux-musl`. A deliberate
target override is available as `BS_DOWNLOADER_TARGET`. The build host must have
the compiler/linker for that target. Consumer distributions such as Ubuntu,
ChimeraOS and CachyOS do not need Rust or these development packages.

The existing Electron packages include the binary. Flatpak runs it inside the
same sandbox and uses the application's existing network and filesystem grants.

## Host protocol

One process owns one download. UTF-8 JSON records, separated by newlines, travel
over stdin/stdout. Passwords and tokens never appear in command-line arguments.
The first command is:

```json
{"command":"start","version":1,"options":{"app":620980,"depot":620981,"manifest":"1234567890123456789","directory":"/absolute/game/path","username":"account","password":"password","qr":false}}
```

`manifest` is a decimal string to preserve all 64 bits in JavaScript. Alternatively,
send a saved `refreshToken`, or `qr: true`. Guard replies use
`{"command":"input","value":"ABCDE"}`. `{"command":"cancel"}` or stdin EOF
cancels network and disk work. The host waits for exit before starting a replacement
process and force-terminates an unresponsive process after five seconds.

Every response has `version`, `type`, `subType` and `data`. Info/Error/Warning events
map to the existing frontend contract. `Session/Authenticated` is consumed only by
the Electron backend. Diagnostic events identify authentication, CM, authorization
and CDN failures without logging passwords, tokens or QR challenges.

Success requires both `Info/Finished` and exit code zero. An unexpected process
exit, malformed response or unfinished output is an error. BSManager writes final
installation metadata only after confirmed success.

## Sessions and network

The host stores remembered refresh tokens with Electron safeStorage. Passwords
are never persisted. Linux needs an available secret store such as Secret Service
or KWallet for persistence; the `basic_text` fallback is refused. Downloads still
work without a secret store, but the user must sign in again. Existing
DepotDownloader session files are not imported, so the first download after
migration requires signing in again.

HTTPS authentication, CM WebSockets and CDN requests share a proxy-aware HTTP
transport. It inherits HTTP_PROXY, HTTPS_PROXY, ALL_PROXY and NO_PROXY, including
their lowercase forms. The host also forwards BSManager's configured Windows
proxy. HTTP(S) and SOCKS proxies are supported. TLS verification remains enabled.

The CM login supplies the regional cell ID used for Steam's CDN list. The engine
tries up to twelve eligible HTTPS mirrors per connection attempt, refreshes CDN
authorization on 401/403, retries transient chunk failures three times, and can
reconnect to Steam up to three times. Verified partial content survives retries.
This improves recovery from individual inaccessible CDNs. It does not guarantee
connectivity where Steam authentication or the CM directory itself is blocked;
real network tests in China are still required.

## Files and limits

Chunks are decrypted, decompressed and checked with Steam's SHA-1 and Adler-32
checksums. The engine supports ZIP/DEFLATE, VZip/LZMA and VZstd/Zstandard. It uses
sixteen concurrent chunk requests, up to eight prepared files and four verification
readers. Pending work and response sizes are bounded.

Progress tracks installed bytes across CDN retries. Existing files are inspected
first for resumption; the final verification phase starts after all files are
installed and reads the complete installation before reporting success. Steam's
zero SHA-1 sentinel is accepted only for empty files with no chunks.

Files are assembled in `.bs-download/<depot>/<manifest>`, verified and replaced
atomically. A per-destination file lock prevents concurrent writers. Cancelling
does not replace an installed file with its incomplete replacement. Missing or
corrupt official files are repaired; extra mod, map and configuration files are
not deleted. An official file modified by a mod is restored when verifying it,
as with a normal game repair.

Manifest v5 is supported. Symlink entries and unsafe paths are rejected. The
manifest signature section must be present, but its RSA signature is not verified;
HTTPS and the manifest/chunk checksums are verified. VZipDelta, LAN transfers,
private branches, disk-space reservation and sharing chunks between installations
are not implemented. Resume data belongs to each installation. A pending marker
identifies the depot and manifest until all files finish, so BSManager can resume
even if its library scan has already discovered the partial installation.

## Tests

```sh
cargo test --locked --manifest-path externals/bs-downloader/Cargo.toml
pnpm exec jest --runInBand src/__tests__/unit/bs-downloader.test.ts
```

The Rust suite uses local HTTP fixtures for authentication, encrypted manifests,
all chunk formats, corrupt data, cache reuse, repair, concurrency and cancellation.
Opt-in `live_` tests contact Steam without account credentials. A real authenticated
Beat Saber download, distribution packaging and China connectivity must also be
checked before release.

## Source references

The authentication, wire formats, content engine and selected filesystem helpers
were adapted from [Zagrios/forge at 692fb562](https://github.com/Zagrios/forge/tree/692fb562d5fd604a919e787ad0db5101d6b751a8),
with a reduced CM client and BSManager-specific protocol, orchestration and build.
There is no build or runtime dependency on Forge. Keep fixes in these shared-origin
parts easy to compare with the original project.

Protocol references used by Forge include [SteamKit](https://github.com/SteamRE/SteamKit)
and [DepotDownloader](https://github.com/SteamRE/DepotDownloader). No C# assemblies
or executables from those projects are included.
