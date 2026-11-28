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
    BsArm64InstallerErrorCode,
    BsArm64Release,
    BsArm64ReleaseAsset,
    BsArm64ModsUnavailable,
    BsArm64Progress,
    BsArm64Status,
    BsArm64Unsupported,
} from "shared/models/bs-arm64/bs-arm64.model";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning } from "shared/models/bs-launch";
import { tryit } from "shared/helpers/error.helpers";
import { BsmShellLog, bsmSpawn } from "main/helpers/os.helpers";
import { IS_FLATPAK } from "main/constants";
import { BSLocalVersionService } from "./bs-local-version.service";
import { InstallationLocationService } from "./installation-location.service";
import { LinuxService } from "./linux.service";
import { RequestService } from "./request.service";
import { SteamService } from "./steam.service";
import { UtilsService } from "./utils.service";
import { BsModsManagerService } from "./mods/bs-mods-manager.service";

// Written by BSManager into the installer's state dir in the instance: which release (and where
// it's unpacked) patched the instance. Uninstall removes the whole dir.
// The installer's state dir in the instance, there while anything of the native build is
const STATE_DIR = ".bs-arm64";
const RELEASE_FILE = path.join(STATE_DIR, "bsm-release.json");

// The user's choice for the instance, native or x64: {"native": boolean}. Outside .bs-arm64/, so
// uninstalling (e.g. as a fallback after a Proton update) keeps it.
const CHOICE_FILE = ".bsm-arm64.json";

// Present when BSIPA is installed (as BsModsManagerService checks)
const BSIPA_INJECTOR = path.join("Beat Saber_Data", "Managed", "IPA.Injector.dll");

// The part of `bs-arm64.sh status --json` BSManager uses (bs-arm64 docs/INSTALL.md, "For launchers")
export type BsArm64ScriptStatus = {
    installed: boolean;
    mods: boolean;
    // Launch works without installing again (Proton unchanged since install)
    ready: boolean;
};

/** The `result` line of a `--json` run of the installer. */
export type BsArm64InstallerResult = { type: "result" } & Record<string, unknown>;

/** One line of `bs-arm64.sh ... --json` output (bs-arm64 docs/INSTALL.md, "For launchers"). */
export type BsArm64InstallerEvent =
    | { type: "log" | "warning"; message: string }
    | { type: "progress"; percent: number }
    | { type: "error"; code: string; message: string }
    | BsArm64InstallerResult;

/** Parses an output line of the installer; anything that isn't one of its JSON objects is a log line. */
export function parseBsArm64InstallerLine(line: string): BsArm64InstallerEvent {
    try {
        const parsed = JSON.parse(line);
        switch (parsed?.type) {
            case "log":
            case "warning":
                if (typeof parsed.message === "string") { return parsed; }
                break;
            case "progress":
                if (typeof parsed.percent === "number") { return parsed; }
                break;
            case "error":
                if (typeof parsed.code === "string" && typeof parsed.message === "string") { return parsed; }
                break;
            case "result":
                return parsed;
            default:
                break;
        }
    } catch {
        // not a JSON line (e.g. output of a program the installer runs)
    }
    return { type: "log", message: line };
}

/** Splits a stream into lines, also when a line arrives in several chunks. */
export function lineReader(onLine: (line: string) => void): { push(chunk: Buffer | string): void; flush(): void } {
    let pending = "";
    const emit = (line: string) => {
        const trimmed = line.trimEnd();
        if (trimmed) { onLine(trimmed); }
    };
    return {
        push(chunk) {
            const lines = (pending + chunk.toString()).split("\n");
            pending = lines.pop() ?? "";
            lines.forEach(emit);
        },
        flush() {
            emit(pending);
            pending = "";
        },
    };
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
 * The Proton to select on ARM64: one a catalog release supports, else a stable one over
 * Experimental, else the first. Undefined if there's none.
 */
export function pickArm64ProtonFolder(candidates: { folder: string; build?: string }[], catalog: BsArm64Release[]): string | undefined {
    const supported = candidates.find(c => findBsArm64Release(catalog, c.build));
    const stable = candidates.find(c => !/experimental/i.test(path.basename(c.folder)));
    return (supported ?? stable ?? candidates[0])?.folder;
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
            native: await this.wantsNative(versionPath),
            protonVersion: this.linux.getProtonBuild(),
            installedRelease: release?.tag,
        };

        const availability = await this.getAvailability(version);
        status.unsupported = availability.unsupported;
        status.supportedVersions = availability.match?.release.bsVersions;
        if (!availability.unsupported) {
            status.bsipaVersion = await BsModsManagerService.getInstance().getBsipaVersion(version).catch((): undefined => undefined);
            status.modsUnavailable = bsArm64ModsUnavailable(availability.match.release, status.bsipaVersion);
        }
        return status;
    }

    /** Whether the native build can be installed into this version now, and the release to use. */
    private async getAvailability(version: BSVersion): Promise<{ unsupported?: BsArm64Unsupported; match?: BsArm64ReleaseMatch }> {
        if (!this.isLinuxArm64()) {
            return { unsupported: BsArm64Unsupported.NOT_LINUX_ARM64 };
        }
        if (!tryit(() => this.linux.isArm64Wine()).result) {
            return { unsupported: BsArm64Unsupported.PROTON_NOT_ARM64 };
        }
        const match = findBsArm64Release(await this.getCatalog(), this.linux.getProtonBuild());
        if (!match) {
            return { unsupported: BsArm64Unsupported.NO_RELEASE };
        }
        if (!match.release.bsVersions.includes(version.BSVersion)) {
            return { unsupported: BsArm64Unsupported.VERSION_NOT_SUPPORTED, match };
        }
        return { match };
    }

    /**
     * On ARM64 Linux without a valid Proton folder: finds the ARM64 Protons in the Steam libraries
     * and selects the best one (pickArm64ProtonFolder), so the user doesn't have to.
     */
    public async autoSelectProtonFolder(): Promise<{ folder?: string; arm64: boolean }> {
        if (!this.isLinuxArm64()) {
            return { arm64: false };
        }
        if (this.linux.verifyProtonPath()) {
            return { arm64: true };
        }
        const libraries = await SteamService.getInstance().getLibraryFolders().catch((): string[] => []);
        const folder = pickArm64ProtonFolder(await this.linux.findArm64ProtonFolders(libraries), await this.getCatalog());
        if (!folder || !(await this.linux.setProtonFolder(folder))) {
            return { arm64: true };
        }
        log.info("Selected the ARM64 Proton", folder);
        return { folder, arm64: true };
    }

    /** Beat Saber versions that can run natively with the selected Proton; empty off ARM64 Linux. */
    public async getNativeVersions(): Promise<string[]> {
        if (!this.isLinuxArm64() || !tryit(() => this.linux.isArm64Wine()).result) {
            return [];
        }
        return findBsArm64Release(await this.getCatalog(), this.linux.getProtonBuild())?.release.bsVersions ?? [];
    }

    private isLinuxArm64(): boolean {
        return process.platform === "linux" && process.arch === "arm64";
    }

    /**
     * Installs the native ARM64 build, always with the ARM64 mod loader fixes: the installer applies
     * them only when BSIPA is installed, and BSManager runs it again after every BSIPA install.
     */
    public install(version: BSVersion): Observable<BsArm64Progress> {
        return new Observable<BsArm64Progress>(obs => {
            (async () => {
                const versionPath = await this.localVersions.getVersionPath(version);
                const release = await this.prepareRelease(msg => obs.next(msg));
                await this.runInstaller(release.dir, ["install", this.quote(versionPath), ...this.prefixArgs()], msg => obs.next(msg));
                await fs.writeJson(path.join(versionPath, RELEASE_FILE), release);
                await this.setWantsNative(versionPath, true);
            })().then(() => obs.complete(), err => obs.error(err));
        });
    }

    /**
     * Puts the x64 files back. Unless `keepChoice`, also remembers that the user wants this version
     * to run as x64; a fallback keeps the choice, so the version goes native again when it can.
     */
    public uninstall(version: BSVersion, { keepChoice = false } = {}): Observable<BsArm64Progress> {
        return new Observable<BsArm64Progress>(obs => {
            (async () => {
                const versionPath = await this.localVersions.getVersionPath(version);
                if (!keepChoice) {
                    await this.setWantsNative(versionPath, false);
                }
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
        if (!script?.installed) {
            return;
        }
        log.info("BSIPA changed in a native ARM64 instance, re-applying the ARM64 mod loader fixes");
        await lastValueFrom(this.install(version), { defaultValue: undefined });
    }

    /**
     * Gets a version ready to launch and returns the bs-arm64.sh that starts it natively, or
     * undefined to start the x64 build. Never asks the user to do anything:
     *  - native wanted (the default) and possible: installs (first launch), repairs (Proton updated)
     *    or updates (newer catalog release) the native build first, reporting BS_ARM64_PREPARING
     *  - native wanted but not possible now (no release for this Proton yet, ...) or the install
     *    failed: puts the x64 files back and reports BS_ARM64_FALLBACK. The choice is kept, so the
     *    next launch after the catalog supports this Proton is native again.
     *  - native not wanted: makes sure the x64 files are in place
     */
    public async prepareLaunch(version: BSVersion, versionPath: string, onEvent: (event: BSLaunchEventData) => void): Promise<string | undefined> {
        if (!this.isLinuxArm64()) {
            return undefined;
        }
        const installed = await this.readInstalledRelease(versionPath);
        if (!(await this.wantsNative(versionPath))) {
            if (installed) {
                await this.restoreX64(version, versionPath);
            }
            return undefined;
        }

        const { unsupported, match } = await this.getAvailability(version);
        if (unsupported) {
            log.info(`Native ARM64 build not available (${unsupported}), launching the x64 build`);
            if (installed) {
                await this.fallBackToX64(version, versionPath, unsupported, onEvent);
            }
            return undefined;
        }

        if (!(await this.isUpToDate(versionPath, installed, match))) {
            onEvent({ type: BSLaunchEvent.BS_ARM64_PREPARING });
            try {
                await lastValueFrom(this.install(version), { defaultValue: undefined });
            } catch (error) {
                log.error("Could not install the native ARM64 build, launching the x64 build", error);
                await this.fallBackToX64(version, versionPath, (error as CustomError)?.data ?? (error as Error)?.message, onEvent);
                return undefined;
            }
        }
        return path.join((await this.readInstalledRelease(versionPath)).dir, "bs-arm64.sh");
    }

    /** Installed from the catalog's current release, set up for the selected Proton, with the mod fixes if BSIPA is there. */
    private async isUpToDate(versionPath: string, installed: InstalledRelease | undefined, match: BsArm64ReleaseMatch): Promise<boolean> {
        if (!installed || installed.tag !== match.release.version || !(await fs.pathExists(path.join(installed.dir, "bs-arm64.sh")))) {
            return false;
        }
        const script = await this.scriptStatus(versionPath, installed).catch((): undefined => undefined);
        if (!script?.installed || !script.ready) {
            return false;
        }
        // Installed with --no-mods by an older BSManager, and BSIPA is there now
        return script.mods || !(await fs.pathExists(path.join(versionPath, BSIPA_INJECTOR)));
    }

    /** Starts this launch as x64 while the native build can't run; the user's choice stays native. */
    private async fallBackToX64(version: BSVersion, versionPath: string, reason: unknown, onEvent: (event: BSLaunchEventData) => void): Promise<void> {
        onEvent({ type: BSLaunchWarning.BS_ARM64_FALLBACK, data: reason });
        await this.restoreX64(version, versionPath);
    }

    /** Uninstalls the native build, so the x64 files are back. Nothing to do if it isn't installed. */
    private async restoreX64(version: BSVersion, versionPath: string): Promise<void> {
        // The installer never touched the instance (e.g. the first install failed to download):
        // uninstalling would only download the release again, which fails the same way offline
        if (!(await fs.pathExists(path.join(versionPath, STATE_DIR)))) {
            return;
        }
        try {
            await lastValueFrom(this.uninstall(version, { keepChoice: true }), { defaultValue: undefined });
        } catch (error) {
            if ((error as CustomError)?.data === BsArm64InstallerErrorCode.NOT_INSTALLED) {
                return;
            }
            throw CustomError.fromError(error as Error, BSLaunchError.BS_ARM64_RESTORE_FAILED);
        }
    }

    // === Choice === //

    /**
     * Whether this version should run natively: the user's choice if they made one, else yes. A
     * supported version then gets the native build on its first launch; others run as x64.
     */
    private async wantsNative(versionPath: string): Promise<boolean> {
        const choice = await fs.readJson(path.join(versionPath, CHOICE_FILE)).catch((): undefined => undefined);
        return typeof choice?.native === "boolean" ? choice.native : true;
    }

    private async setWantsNative(versionPath: string, native: boolean): Promise<void> {
        await fs.writeJson(path.join(versionPath, CHOICE_FILE), { native });
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
        await this.run(`tar -xzf ${this.quote(tarball)} -C ${this.quote(this.releasesDir())}`, line => progress({ log: line }));
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

    /**
     * Runs bs-arm64.sh with --json: its log lines and download progress go to `progress`, and a
     * failure carries the installer's stable error code (BsArm64InstallerErrorCode) as `data`.
     * Returns the `result` the command printed, if any.
     */
    private async runInstaller(dir: string, args: string[], progress: (p: BsArm64Progress) => void): Promise<BsArm64InstallerResult | undefined> {
        let failure: { code: string; message: string } | undefined;
        let result: BsArm64InstallerResult | undefined;
        try {
            await this.run(`bash ${this.quote(path.join(dir, "bs-arm64.sh"))} ${[...args, "--json"].join(" ")}`, (line, isError) => {
                const event = isError ? { type: "log" as const, message: line } : parseBsArm64InstallerLine(line);
                switch (event.type) {
                    case "progress": progress({ percent: event.percent }); break;
                    case "error": failure = event; progress({ log: `error: ${event.message}` }); break;
                    case "result": result = event; break;
                    case "warning": progress({ log: `warning: ${event.message}` }); break;
                    default: progress({ log: event.message });
                }
            });
            return result;
        } catch (error) {
            throw new CustomError(failure?.message ?? (error as Error)?.message, BsArm64Error.INSTALLER_FAILED, failure?.code);
        }
    }

    /** The installer's view of the instance; undefined if the release has no `status` (0.3.x and older). */
    private async scriptStatus(versionPath: string, release: InstalledRelease): Promise<BsArm64ScriptStatus | undefined> {
        if (!(await fs.pathExists(path.join(release.dir, "bs_arm64")))) {
            return undefined;
        }
        const result = await this.runInstaller(release.dir, ["status", this.quote(versionPath), ...this.prefixArgs()], () => {});
        if (typeof result?.installed !== "boolean") {
            return undefined;
        }
        return { installed: result.installed, mods: result.mods === true, ready: result.ready === true };
    }

    /** Runs a command, passing each complete output line to `onLine`. Rejects on a non-zero exit. */
    private run(command: string, onLine: (line: string, isError: boolean) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const child = bsmSpawn(command, {
                log: BsmShellLog.Command,
                flatpak: { host: IS_FLATPAK },
            });
            let lastError = "";
            const reader = (isError: boolean) => lineReader(line => {
                if (isError) {
                    log.warn("bs-arm64:", line);
                    lastError = line;
                } else {
                    log.info("bs-arm64:", line);
                }
                onLine(line, isError);
            });
            const stdout = reader(false);
            const stderr = reader(true);
            child.stdout?.on("data", d => stdout.push(d));
            child.stderr?.on("data", d => stderr.push(d));
            child.once("error", reject);
            child.once("close", code => {
                stdout.flush();
                stderr.flush();
                return code === 0 ? resolve() : reject(new Error(lastError || `exit code ${code}`));
            });
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
