/**
 * Native ARM64 build of Beat Saber for ARM64 Proton (e.g. the Steam Frame).
 * The runtime itself lives in https://github.com/DaVarga/bs-arm64. BSManager only installs the
 * releases listed in its own catalog, assets/jsons/bs-arm64-releases.json, and checks every
 * download against the SHA-256 pinned there before running the release's installer.
 */

export const BS_ARM64_REPOSITORY = "DaVarga/bs-arm64";

// Catalog of reviewed releases, bundled with BSManager and refreshed from this repository like
// bs-versions.json, so a new release or Proton version needs a catalog update, not a BSManager release
export const BS_ARM64_RELEASES_FILE = "bs-arm64-releases.json";
export const BS_ARM64_RELEASES_URL = `https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/${BS_ARM64_RELEASES_FILE}`;

export interface BsArm64ReleaseAsset {
    // Release asset to install, e.g. "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz"
    artifact: string;
    // SHA-256 of the asset (hex), checked before it is unpacked
    sha256: string;
}

/** A release in the catalog: entries of its bs-arm64-manifest.json, plus the pinned checksums. */
export interface BsArm64Release {
    // Release tag, e.g. "v0.4.1"
    version: string;
    // Asset to install, by Proton tag ("proton-11.0-2e"), each tested on the Steam Frame
    protonVersions: Record<string, BsArm64ReleaseAsset>;
    bsVersions: string[];
    bsipaVersions: string[];
}

export enum BsArm64Unsupported {
    NOT_LINUX_ARM64 = "NOT_LINUX_ARM64",
    PROTON_NOT_ARM64 = "PROTON_NOT_ARM64",
    NO_RELEASE = "NO_RELEASE",
    VERSION_NOT_SUPPORTED = "VERSION_NOT_SUPPORTED",
}

// Why mods may not work with the native ARM64 build
export enum BsArm64ModsUnavailable {
    // BSIPA isn't installed and BeatMods has none for this version
    NO_BSIPA = "NO_BSIPA",
    // The BSIPA version isn't one the release was tested with
    BSIPA_NOT_SUPPORTED = "BSIPA_NOT_SUPPORTED",
}

export interface BsArm64Status {
    // Why this instance can't be patched; undefined when it can
    unsupported?: BsArm64Unsupported;
    // Beat Saber versions the release matching the Proton build was tested with
    supportedVersions?: string[];
    // Why mods may not work with the native build; undefined when they should
    modsUnavailable?: BsArm64ModsUnavailable;
    // Installed BSIPA, else the one BeatMods offers for this version
    bsipaVersion?: string;
    installed: boolean;
    // Installed with the ARM64 mod loader fixes (false for instances installed with --no-mods by
    // BSManager versions that offered that)
    mods: boolean;
    // Build of the selected Proton, e.g. "proton-11.0-2c-arm64"
    protonVersion?: string;
    // This version should run natively: the user's choice, else true. With `unsupported` set, it
    // runs as x64 for now.
    native: boolean;
    // The game can be launched without installing again (false after a Proton update, or for an
    // instance installed by a release older than BSManager supports)
    ready: boolean;
    // bs-arm64 release the instance was patched with, e.g. "v0.1.1"
    installedRelease?: string;
}

export interface BsArm64Progress {
    // Output line of the download or installer, for the log view
    log?: string;
    // Download progress, 0-100
    percent?: number;
}

export enum BsArm64Error {
    NO_MATCHING_RELEASE = "BS_ARM64_NO_MATCHING_RELEASE",
    CHECKSUM_MISMATCH = "BS_ARM64_CHECKSUM_MISMATCH",
    // `data` is the installer's error code (BsArm64InstallerErrorCode), if it reported one
    INSTALLER_FAILED = "BS_ARM64_INSTALLER_FAILED",
}

/** The installer's stable error codes (bs-arm64 install/bs_arm64/errors.py), shown as translated messages. */
export enum BsArm64InstallerErrorCode {
    NOT_AN_INSTANCE = "NOT_AN_INSTANCE",
    NOT_INSTALLED = "NOT_INSTALLED",
    UNSUPPORTED_ENGINE = "UNSUPPORTED_ENGINE",
    PROTON_NOT_ARM64 = "PROTON_NOT_ARM64",
    PROTON_UNTESTED = "PROTON_UNTESTED",
    PROTON_CHANGED = "PROTON_CHANGED",
    ARTIFACT_MISSING = "ARTIFACT_MISSING",
    PREFIX_BUSY = "PREFIX_BUSY",
    PREFIX_FAILED = "PREFIX_FAILED",
    DOWNLOAD_FAILED = "DOWNLOAD_FAILED",
}

export function isBsArm64InstallerErrorCode(code: unknown): code is BsArm64InstallerErrorCode {
    return Object.values(BsArm64InstallerErrorCode).includes(code as BsArm64InstallerErrorCode);
}
