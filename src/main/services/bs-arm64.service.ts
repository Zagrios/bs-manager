import path from "node:path";
import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "fs-extra";
import log from "electron-log";
import { Observable, lastValueFrom, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import {
    BS_ARM64_FALLBACK_MANIFEST,
    BS_ARM64_MANIFEST_ASSET,
    BS_ARM64_REPOSITORY,
    BsArm64Error,
    BsArm64Manifest,
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

export type GithubRelease = {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    assets: { name: string; browser_download_url: string }[];
};

type InstalledRelease = { tag: string; dir: string };

type ReleaseAsset = { release: GithubRelease; asset: GithubRelease["assets"][number] };

// The newest release's manifest and its asset for a Proton build
type ReleaseInfo = { protonBuild: string | undefined; match?: ReleaseAsset; manifest: BsArm64Manifest };

// GitHub allows 60 unauthenticated API requests an hour; the status is asked for on every version view
const RELEASE_INFO_TTL_MS = 10 * 60 * 1000;

// Proton's version file says e.g. "proton-11.0-2c-arm64" for the tag "proton-11.0-2c"
function isBuildOfProtonTag(protonBuild: string, protonTag: string): boolean {
    return protonBuild === protonTag || protonBuild.startsWith(`${protonTag}-`);
}

/** The asset of a release to install for the given Proton build: the one its manifest names. */
export function findBsArm64ReleaseAsset(release: GithubRelease, manifest: BsArm64Manifest, protonBuild: string | undefined): ReleaseAsset | undefined {
    if (!protonBuild) {
        return undefined;
    }
    const entry = Object.entries(manifest.protonVersions).find(([protonTag]) => isBuildOfProtonTag(protonBuild, protonTag))?.[1];
    const asset = entry && release.assets.find(a => a.name === entry.artifact);
    return asset ? { release, asset } : undefined;
}

/** What a release was tested with; BS_ARM64_FALLBACK_MANIFEST when GitHub can't be reached. */
export function bsArm64Supported(manifest: BsArm64Manifest | undefined): Pick<BsArm64Manifest, "bsVersions" | "bsipaVersions"> {
    return manifest ?? BS_ARM64_FALLBACK_MANIFEST;
}

/** Why mod support can't be installed: no BSIPA, or one the release wasn't tested with. */
export function bsArm64ModsUnavailable(manifest: BsArm64Manifest | undefined, bsipaVersion: string | undefined): BsArm64ModsUnavailable | undefined {
    if (!bsipaVersion) {
        return BsArm64ModsUnavailable.NO_BSIPA;
    }
    return bsArm64Supported(manifest).bsipaVersions.includes(bsipaVersion) ? undefined : BsArm64ModsUnavailable.BSIPA_NOT_SUPPORTED;
}

/**
 * Installs the native ARM64 runtime from https://github.com/DaVarga/bs-arm64 into a
 * Beat Saber instance. The release matching the selected Proton build is downloaded,
 * verified and unpacked into BSManager's cache, and its bs-arm64.sh does the rest.
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

    private releaseInfo?: { info: ReleaseInfo; time: number };

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

        // Offline or GitHub unreachable: fall back to what releases without a manifest support
        const info = await this.getReleaseInfo().catch((error): undefined => {
            log.warn("Could not get the bs-arm64 releases", error);
            return undefined;
        });
        if (info && !info.match) {
            status.unsupported = BsArm64Unsupported.NO_RELEASE;
            return status;
        }

        status.supportedVersions = bsArm64Supported(info?.manifest).bsVersions;
        if (!status.supportedVersions.includes(version.BSVersion)) {
            status.unsupported = BsArm64Unsupported.VERSION_NOT_SUPPORTED;
            return status;
        }

        status.bsipaVersion = await BsModsManagerService.getInstance().getBsipaVersion(version).catch((): undefined => undefined);
        status.modsUnavailable = bsArm64ModsUnavailable(info?.manifest, status.bsipaVersion);
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

    /** The newest release, its asset for the selected Proton build, and its manifest. Cached for a while. */
    private async getReleaseInfo(): Promise<ReleaseInfo> {
        const protonBuild = this.linux.getProtonBuild();
        const cached = this.releaseInfo;
        if (cached && cached.info.protonBuild === protonBuild && Date.now() - cached.time < RELEASE_INFO_TTL_MS) {
            return cached.info;
        }

        // Only the newest release: its manifest lists every supported Proton version
        const { data: release } = await this.request.getJSON<GithubRelease>(
            `https://api.github.com/repos/${BS_ARM64_REPOSITORY}/releases/latest`
        );
        const manifestAsset = release.assets.find(asset => asset.name === BS_ARM64_MANIFEST_ASSET);
        if (!manifestAsset) {
            throw new Error(`bs-arm64 ${release.tag_name} has no ${BS_ARM64_MANIFEST_ASSET}`);
        }
        const manifest = await this.downloadManifest(manifestAsset.browser_download_url);
        const match = findBsArm64ReleaseAsset(release, manifest, protonBuild);
        const info: ReleaseInfo = { protonBuild, match, manifest };

        this.releaseInfo = { info, time: Date.now() };
        return info;
    }

    private async downloadManifest(url: string): Promise<BsArm64Manifest> {
        await fs.ensureDir(this.releasesDir());
        const file = path.join(this.releasesDir(), `manifest-${Date.now()}.json`);
        try {
            await lastValueFrom(this.request.downloadFile(url, file));
            const manifest: BsArm64Manifest = await fs.readJson(file);
            if (!Array.isArray(manifest?.bsVersions) || !Array.isArray(manifest?.bsipaVersions) || !manifest.protonVersions || typeof manifest.protonVersions !== "object") {
                throw new Error(`Invalid ${BS_ARM64_MANIFEST_ASSET}`);
            }
            return manifest;
        } finally {
            await fs.remove(file);
        }
    }

    /** Newest release built for the selected Proton build, downloaded and unpacked. */
    private async prepareRelease(progress: (p: BsArm64Progress) => void): Promise<InstalledRelease> {
        this.releaseInfo = undefined;
        const { protonBuild, match } = await this.getReleaseInfo();

        if (!match) {
            throw new CustomError(`No bs-arm64 release for ${protonBuild}`, BsArm64Error.NO_MATCHING_RELEASE, protonBuild);
        }

        const { release, asset } = match;
        const name = asset.name.slice(0, -".tar.gz".length);
        const dir = path.join(this.releasesDir(), name);
        if (await fs.pathExists(path.join(dir, "bs-arm64.sh"))) {
            progress({ log: `Using ${name}` });
            return { tag: release.tag_name, dir };
        }

        await fs.ensureDir(this.releasesDir());
        const tarball = path.join(this.releasesDir(), asset.name);
        progress({ log: `Downloading ${asset.name}` });
        await lastValueFrom(this.request.downloadFile(asset.browser_download_url, tarball).pipe(
            tap(p => p.total && progress({ percent: Math.round((p.current / p.total) * 100) }))
        ));

        const checksumAsset = release.assets.find(a => a.name === `${asset.name}.sha256`);
        if (checksumAsset) {
            const expected = await this.downloadChecksum(checksumAsset.browser_download_url);
            const actual = await this.sha256(tarball);
            if (expected !== actual) {
                await fs.remove(tarball);
                throw new CustomError(`Checksum mismatch for ${asset.name}`, BsArm64Error.CHECKSUM_MISMATCH);
            }
            progress({ log: "Checksum OK" });
        }

        progress({ log: `Unpacking into ${this.releasesDir()}` });
        await this.run(`tar -xzf ${this.quote(tarball)} -C ${this.quote(this.releasesDir())}`, progress);
        await fs.remove(tarball);
        return { tag: release.tag_name, dir };
    }

    // "<sha256>  <file name>"
    private async downloadChecksum(url: string): Promise<string> {
        const file = path.join(this.releasesDir(), `checksum-${Date.now()}.txt`);
        await lastValueFrom(this.request.downloadFile(url, file));
        const text = await fs.readFile(file, "utf8");
        await fs.remove(file);
        return text.trim().split(/\s+/)[0];
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
