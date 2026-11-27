import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "fs-extra";
import log from "electron-log";
import { Observable, lastValueFrom, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import {
    BS_ARM64_RELEASES_FILE,
    BS_ARM64_RELEASES_URL,
    BS_ARM64_REPOSITORY,
    BsArm64Error,
    BsArm64Release,
    BsArm64ReleaseAsset,
    BsArm64ModsUnavailable,
    BsArm64InstallOptions,
    BsArm64Progress,
    BsArm64Status,
    BsArm64Unsupported,
} from "shared/models/bs-arm64/bs-arm64.model";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSLaunchError } from "shared/models/bs-launch";
import { tryit } from "shared/helpers/error.helpers";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { IS_FLATPAK } from "main/constants";
import { BSLocalVersionService } from "./bs-local-version.service";
import { InstallationLocationService } from "./installation-location.service";
import { LinuxService } from "./linux.service";
import { RequestService } from "./request.service";
import { UtilsService } from "./utils.service";
import { BsModsManagerService } from "./mods/bs-mods-manager.service";

// Written by BSManager into the installer's state dir in the instance: which release (and where
// it's unpacked) patched the instance. Uninstall removes the whole dir.
const RELEASE_FILE = path.join(".bs-arm64", "bsm-release.json");

// The part of `bs-arm64.sh status --json` BSManager uses (bs-arm64 docs/INSTALL.md, "For launchers")
export type BsArm64ScriptStatus = {
    installed: boolean;
    mods: boolean;
    // Launch works without installing again (Proton unchanged since install)
    ready: boolean;
};

/** The `result` line of a `--json` run of the installer. */
export function parseBsArm64Result(lines: string[]): BsArm64ScriptStatus | undefined {
    for (const line of [...lines].reverse()) {
        try {
            const parsed = JSON.parse(line);
            if (parsed?.type === "result") {
                return parsed;
            }
        } catch {
            // not a JSON line
        }
    }
    return undefined;
}

type InstalledRelease = { tag: string; dir: string };

/** A catalog release and its asset for the selected Proton build. */
export type BsArm64ReleaseMatch = { release: BsArm64Release; asset: BsArm64ReleaseAsset };

// The catalog changes rarely; the status is asked for on every version view
const CATALOG_TTL_MS = 10 * 60 * 1000;
const CATALOG_TIMEOUT_MS = 15_000;

// Strict, because tags and artifact names end up in download URLs and cache paths
const RELEASE_TAG = /^v\d+(\.\d+)*(-[\w.]+)?$/;
const ARTIFACT_NAME = /^bs-arm64-[\w.-]+\.tar\.gz$/;
const SHA256 = /^[0-9a-f]{64}$/;

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(v => typeof v === "string");
}

function isReleaseAsset(value: unknown): value is BsArm64ReleaseAsset {
    const asset = value as BsArm64ReleaseAsset;
    return typeof asset?.artifact === "string" && ARTIFACT_NAME.test(asset.artifact) && !asset.artifact.includes("..")
        && typeof asset.sha256 === "string" && SHA256.test(asset.sha256);
}

function isRelease(value: unknown): value is BsArm64Release {
    const release = value as BsArm64Release;
    return typeof release?.version === "string" && RELEASE_TAG.test(release.version)
        && isStringArray(release.bsVersions) && isStringArray(release.bsipaVersions)
        && !!release.protonVersions && typeof release.protonVersions === "object"
        && Object.values(release.protonVersions).every(isReleaseAsset);
}

/** A valid bs-arm64-releases.json: releases newest first. */
export function isBsArm64Catalog(value: unknown): value is BsArm64Release[] {
    return Array.isArray(value) && value.every(isRelease);
}

// Proton's version file says e.g. "proton-11.0-2c-arm64" for the tag "proton-11.0-2c"
function isBuildOfProtonTag(protonBuild: string, protonTag: string): boolean {
    return protonBuild === protonTag || protonBuild.startsWith(`${protonTag}-`);
}

/** The newest catalog release that has an asset for the given Proton build. */
export function findBsArm64Release(catalog: BsArm64Release[], protonBuild: string | undefined): BsArm64ReleaseMatch | undefined {
    if (!protonBuild) {
        return undefined;
    }
    for (const release of catalog) {
        const asset = Object.entries(release.protonVersions).find(([protonTag]) => isBuildOfProtonTag(protonBuild, protonTag))?.[1];
        if (asset) {
            return { release, asset };
        }
    }
    return undefined;
}

/** Where a catalog asset is downloaded from: always a release of BS_ARM64_REPOSITORY. */
export function bsArm64DownloadUrl({ release, asset }: BsArm64ReleaseMatch): string {
    return `https://github.com/${BS_ARM64_REPOSITORY}/releases/download/${release.version}/${asset.artifact}`;
}

/** Why mod support can't be installed: no BSIPA, or one the release wasn't tested with. */
export function bsArm64ModsUnavailable(release: BsArm64Release, bsipaVersion: string | undefined): BsArm64ModsUnavailable | undefined {
    if (!bsipaVersion) {
        return BsArm64ModsUnavailable.NO_BSIPA;
    }
    return release.bsipaVersions.includes(bsipaVersion) ? undefined : BsArm64ModsUnavailable.BSIPA_NOT_SUPPORTED;
}

/**
 * Installs the native ARM64 runtime from https://github.com/DaVarga/bs-arm64 into a
 * Beat Saber instance. The catalog release matching the selected Proton build is downloaded,
 * checked against its pinned SHA-256 and unpacked into BSManager's cache, and its bs-arm64.sh
 * does the rest.
 */
export class BsArm64Service {
    private static instance: BsArm64Service;

    public static getInstance(): BsArm64Service {
        if (!BsArm64Service.instance) {
            BsArm64Service.instance = new BsArm64Service();
        }
        return BsArm64Service.instance;
    }

    private readonly linux = LinuxService.getInstance();
    private readonly localVersions = BSLocalVersionService.getInstance();
    private readonly installLocation = InstallationLocationService.getInstance();
    private readonly request = RequestService.getInstance();
    private readonly utils = UtilsService.getInstance();

    private catalog?: { releases: BsArm64Release[]; time: number };

    private constructor() {}

    public async getStatus(version: BSVersion): Promise<BsArm64Status> {
        const versionPath = await this.localVersions.getVersionPath(version);
        const release = await this.readInstalledRelease(versionPath);
        const script = release && await this.scriptStatus(versionPath, release);
        const status: BsArm64Status = {
            // Installed by a release without `status` (0.3.x and older): only a reinstall helps
            installed: script ? script.installed : !!release,
            mods: !!script?.mods,
            ready: !!script?.ready,
            protonVersion: this.linux.getProtonBuild(),
            installedRelease: release?.tag,
        };

        if (process.platform !== "linux" || process.arch !== "arm64") {
            status.unsupported = BsArm64Unsupported.NOT_LINUX_ARM64;
            return status;
        }
        if (!tryit(() => this.linux.isArm64Wine()).result) {
            status.unsupported = BsArm64Unsupported.PROTON_NOT_ARM64;
            return status;
        }

        const match = findBsArm64Release(await this.getCatalog(), status.protonVersion);
        if (!match) {
            status.unsupported = BsArm64Unsupported.NO_RELEASE;
            return status;
        }

        status.supportedVersions = match.release.bsVersions;
        if (!status.supportedVersions.includes(version.BSVersion)) {
            status.unsupported = BsArm64Unsupported.VERSION_NOT_SUPPORTED;
            return status;
        }

        status.bsipaVersion = await BsModsManagerService.getInstance().getBsipaVersion(version).catch((): undefined => undefined);
        status.modsUnavailable = bsArm64ModsUnavailable(match.release, status.bsipaVersion);
        return status;
    }

    public install(version: BSVersion, options: BsArm64InstallOptions): Observable<BsArm64Progress> {
        return new Observable<BsArm64Progress>(obs => {
            (async () => {
                const versionPath = await this.localVersions.getVersionPath(version);
                const release = await this.prepareRelease(msg => obs.next(msg));
                const args = ["install", this.quote(versionPath), ...this.prefixArgs()];
                if (!options.mods) {
                    args.push("--no-mods");
                }
                await this.runInstaller(release.dir, args, msg => obs.next(msg));
                await fs.writeJson(path.join(versionPath, RELEASE_FILE), release);
            })().then(() => obs.complete(), err => obs.error(err));
        });
    }

    public uninstall(version: BSVersion): Observable<BsArm64Progress> {
        return new Observable<BsArm64Progress>(obs => {
            (async () => {
                const versionPath = await this.localVersions.getVersionPath(version);
                const installed = await this.readInstalledRelease(versionPath);
                const dir = installed && await fs.pathExists(path.join(installed.dir, "bs-arm64.sh"))
                    ? installed.dir
                    : (await this.prepareRelease(msg => obs.next(msg))).dir;
                await this.runInstaller(dir, ["uninstall", this.quote(versionPath), ...this.prefixArgs()], msg => obs.next(msg));
            })().then(() => obs.complete(), err => obs.error(err));
        });
    }

    /**
     * Installing or updating BSIPA puts its x64 winhttp.dll and MonoMod.Core.dll back.
     * Run the installer again so the instance gets the ARM64 ones.
     */
    public async reapplyAfterBsipaChange(version: BSVersion): Promise<void> {
        const versionPath = await this.localVersions.getVersionPath(version);
        const release = await this.readInstalledRelease(versionPath);
        const script = release && await this.scriptStatus(versionPath, release);
        if (!script?.installed || !script.mods) {
            return;
        }
        log.info("BSIPA changed in a native ARM64 instance, re-applying the ARM64 mod loader fixes");
        await lastValueFrom(this.install(version, { mods: true }), { defaultValue: undefined });
    }

    /**
     * bs-arm64.sh of the release that installed this native ARM64 instance, which launches it;
     * undefined if the instance isn't one. Throws if the installer says it needs a reinstall first
     * (Proton changed since install), or the release predates `status` (0.3.x and older).
     */
    public async getLaunchScript(versionPath: string): Promise<string | undefined> {
        const release = await this.readInstalledRelease(versionPath);
        if (!release) {
            return undefined;
        }
        const script = await this.scriptStatus(versionPath, release).catch((): undefined => undefined);
        if (!script?.ready) {
            throw CustomError.fromError(new Error(`Native ARM64 instance (${release.tag}) needs a reinstall`), BSLaunchError.BS_ARM64_OUTDATED);
        }
        return path.join(release.dir, "bs-arm64.sh");
    }

    // === Release === //

    private releasesDir(): string {
        return path.join(this.installLocation.cachePath(), "bs-arm64");
    }

    /**
     * The release catalog: the one in this repository, else the copy bundled with BSManager
     * (offline, or the remote one is invalid). Cached for a while.
     */
    private async getCatalog({ refresh = false } = {}): Promise<BsArm64Release[]> {
        const cached = this.catalog;
        if (!refresh && cached && Date.now() - cached.time < CATALOG_TTL_MS) {
            return cached.releases;
        }

        const releases = await this.getRemoteCatalog().catch(async (error): Promise<BsArm64Release[]> => {
            log.warn("Could not get the remote bs-arm64 release catalog, using the bundled one", error);
            return this.getBundledCatalog();
        });
        this.catalog = { releases, time: Date.now() };
        return releases;
    }

    private async getRemoteCatalog(): Promise<BsArm64Release[]> {
        const abort = new AbortController();
        const timeout = setTimeout(() => abort.abort(), CATALOG_TIMEOUT_MS);
        try {
            const { data } = await this.request.getJSON<unknown>(BS_ARM64_RELEASES_URL, { signal: abort.signal, retryLimit: 0 });
            if (!isBsArm64Catalog(data)) {
                throw new Error(`Invalid ${BS_ARM64_RELEASES_FILE}`);
            }
            return data;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async getBundledCatalog(): Promise<BsArm64Release[]> {
        const data: unknown = await fs.readJson(path.join(this.utils.getAssestsJsonsPath(), BS_ARM64_RELEASES_FILE)).catch((error): undefined => {
            log.error("Could not read the bundled bs-arm64 release catalog", error);
            return undefined;
        });
        if (!isBsArm64Catalog(data)) {
            log.error(`Ignoring an invalid bundled ${BS_ARM64_RELEASES_FILE}`);
            return [];
        }
        return data;
    }

    /** Newest catalog release for the selected Proton build, downloaded, verified and unpacked. */
    private async prepareRelease(progress: (p: BsArm64Progress) => void): Promise<InstalledRelease> {
        const protonBuild = this.linux.getProtonBuild();
        const match = findBsArm64Release(await this.getCatalog({ refresh: true }), protonBuild);

        if (!match) {
            throw new CustomError(`No bs-arm64 release for ${protonBuild}`, BsArm64Error.NO_MATCHING_RELEASE, protonBuild);
        }

        const { release, asset } = match;
        const name = asset.artifact.slice(0, -".tar.gz".length);
        const dir = path.join(this.releasesDir(), name);
        if (await fs.pathExists(path.join(dir, "bs-arm64.sh"))) {
            progress({ log: `Using ${name}` });
            return { tag: release.version, dir };
        }

        await fs.ensureDir(this.releasesDir());
        const tarball = path.join(this.releasesDir(), asset.artifact);
        progress({ log: `Downloading ${asset.artifact}` });
        await lastValueFrom(this.request.downloadFile(bsArm64DownloadUrl(match), tarball).pipe(
            tap(p => p.total && progress({ percent: Math.round((p.current / p.total) * 100) }))
        ));

        // Pinned in the catalog: only the reviewed file gets unpacked and run
        const actual = await this.sha256(tarball);
        if (actual !== asset.sha256) {
            await fs.remove(tarball);
            throw new CustomError(`Checksum mismatch for ${asset.artifact}`, BsArm64Error.CHECKSUM_MISMATCH);
        }
        progress({ log: "Checksum OK" });

        progress({ log: `Unpacking into ${this.releasesDir()}` });
        await this.run(`tar -xzf ${this.quote(tarball)} -C ${this.quote(this.releasesDir())}`, progress);
        await fs.remove(tarball);
        return { tag: release.version, dir };
    }

    private sha256(file: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash("sha256");
            createReadStream(file)
                .on("data", chunk => hash.update(chunk))
                .on("error", reject)
                .on("end", () => resolve(hash.digest("hex")));
        });
    }

    // === Installer === //

    private prefixArgs(): string[] {
        return ["--prefix", this.quote(this.linux.getCompatDataPath()), "--proton", this.quote(this.linux.getProtonFolder())];
    }

    private async runInstaller(dir: string, args: string[], progress: (p: BsArm64Progress) => void): Promise<void> {
        try {
            await this.run(`bash ${this.quote(path.join(dir, "bs-arm64.sh"))} ${args.join(" ")}`, progress);
        } catch (error) {
            throw CustomError.fromError(error as Error, BsArm64Error.INSTALLER_FAILED, (error as Error)?.message);
        }
    }

    /** The installer's view of the instance; undefined if the release has no `status` (0.3.x and older). */
    private async scriptStatus(versionPath: string, release: InstalledRelease): Promise<BsArm64ScriptStatus | undefined> {
        if (!(await fs.pathExists(path.join(release.dir, "bs_arm64")))) {
            return undefined;
        }
        const lines: string[] = [];
        await this.runInstaller(release.dir, ["status", this.quote(versionPath), ...this.prefixArgs(), "--json"],
            p => p.log && lines.push(p.log));
        return parseBsArm64Result(lines);
    }

    private run(command: string, progress: (p: BsArm64Progress) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = bsmSpawn(command, {
                log: BsmShellLog.Command,
                flatpak: { host: IS_FLATPAK },
            });
            let lastError = "";
            const forward = (data: Buffer, isError: boolean) => {
                for (const line of data.toString().split("\n").map(l => l.trimEnd()).filter(Boolean)) {
                    if (isError) {
                        log.warn("bs-arm64:", line);
                        lastError = line;
                    } else {
                        log.info("bs-arm64:", line);
                    }
                    progress({ log: line });
                }
            };
            child.stdout?.on("data", d => forward(d, false));
            child.stderr?.on("data", d => forward(d, true));
            child.once("error", reject);
            child.once("close", code => (code === 0 ? resolve() : reject(new Error(lastError || `exit code ${code}`))));
        });
    }

    // === State === //

    private async readInstalledRelease(versionPath: string): Promise<InstalledRelease | undefined> {
        return fs.readJson(path.join(versionPath, RELEASE_FILE)).catch((): undefined => undefined);
    }

    private quote(value: string): string {
        return `'${value.replaceAll("'", `'"'"'`)}'`;
    }
}
