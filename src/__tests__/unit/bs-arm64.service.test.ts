import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import fs from "fs-extra";
import {
    BsArm64Service,
    bsArm64DownloadUrl,
    bsArm64ModsUnavailable,
    findBsArm64Release,
    isBsArm64Catalog,
    lineReader,
    parseBsArm64InstallerLine,
} from "main/services/bs-arm64.service";
import { bsmSpawn } from "main/helpers/os.helpers";
import { BSLaunchError } from "shared/models/bs-launch";
import {
    BS_ARM64_RELEASES_URL,
    BsArm64Error,
    BsArm64InstallerErrorCode,
    BsArm64ModsUnavailable,
    BsArm64Progress,
    BsArm64Release,
} from "shared/models/bs-arm64/bs-arm64.model";

jest.mock("electron", () => ({ app: { getPath: () => "", getVersion: () => "0.0.0" } }));
jest.mock("main/helpers/os.helpers", () => ({ ...jest.requireActual("main/helpers/os.helpers"), bsmSpawn: jest.fn() }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn() } }));
jest.mock("main/services/installation-location.service", () => ({ InstallationLocationService: { getInstance: jest.fn() } }));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn() } }));
jest.mock("main/services/request.service", () => ({ RequestService: { getInstance: jest.fn() } }));
jest.mock("main/services/utils.service", () => ({ UtilsService: { getInstance: jest.fn() } }));
jest.mock("main/services/mods/bs-mods-manager.service", () => ({ BsModsManagerService: { getInstance: jest.fn() } }));

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);

function release(version: string, protonVersions: BsArm64Release["protonVersions"], extra: Partial<BsArm64Release> = {}): BsArm64Release {
    return { version, protonVersions, bsVersions: ["1.44.1"], bsipaVersions: ["4.3.7"], ...extra };
}

describe("bs-arm64 release catalog", () => {
    it("accepts the catalog bundled with BSManager", async () => {
        const bundled = await fs.readJson(path.join(__dirname, "../../../assets/jsons/bs-arm64-releases.json"));
        expect(isBsArm64Catalog(bundled)).toBe(true);
        expect(bundled.length).toBeGreaterThan(0);
    });

    it("accepts releases with a pinned SHA-256 for every asset", () => {
        expect(isBsArm64Catalog([release("v0.4.1", { "proton-11.0-2c": { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz", sha256: SHA_A } })])).toBe(true);
        expect(isBsArm64Catalog([])).toBe(true);
    });

    it("rejects assets without a valid SHA-256", () => {
        const asset = { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz" };
        expect(isBsArm64Catalog([release("v0.4.1", { "proton-11.0-2c": asset as never })])).toBe(false);
        expect(isBsArm64Catalog([release("v0.4.1", { "proton-11.0-2c": { ...asset, sha256: "ABC" } })])).toBe(false);
    });

    it("rejects artifact names and tags that could leave the download URL or cache dir", () => {
        const ok = { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz", sha256: SHA_A };
        expect(isBsArm64Catalog([release("v0.4.1", { p: { ...ok, artifact: "../bs-arm64-x.tar.gz" } })])).toBe(false);
        expect(isBsArm64Catalog([release("v0.4.1", { p: { ...ok, artifact: "bs-arm64-..tar.gz" } })])).toBe(false);
        expect(isBsArm64Catalog([release("v0.4.1", { p: { ...ok, artifact: "evil.sh" } })])).toBe(false);
        expect(isBsArm64Catalog([release("v0.4.1/../x", { p: ok })])).toBe(false);
        expect(isBsArm64Catalog([release("latest", { p: ok })])).toBe(false);
    });

    it("rejects anything that isn't a list of releases", () => {
        expect(isBsArm64Catalog({})).toBe(false);
        expect(isBsArm64Catalog([{ version: "v0.4.1" }])).toBe(false);
        expect(isBsArm64Catalog(undefined)).toBe(false);
    });
});

describe("findBsArm64Release", () => {
    const v040 = release("v0.4.0", {
        "proton-11.0-2c": { artifact: "bs-arm64-v0.4.0-proton-11.0-2c.tar.gz", sha256: SHA_A },
        "proton-11.0-3": { artifact: "bs-arm64-v0.4.0-proton-11.0-3.tar.gz", sha256: SHA_B },
    });
    const v041 = release("v0.4.1", {
        "proton-11.0-2c": { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz", sha256: SHA_A },
        // Same files as 2c
        "proton-11.0-2e": { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz", sha256: SHA_A },
    });
    const catalog = [v041, v040];

    it("picks the newest release with an asset for the Proton build", () => {
        expect(findBsArm64Release(catalog, "proton-11.0-2c-arm64")).toEqual({ release: v041, asset: v041.protonVersions["proton-11.0-2c"] });
        expect(findBsArm64Release(catalog, "proton-11.0-2e-arm64")?.asset.artifact).toBe("bs-arm64-v0.4.1-proton-11.0-2c.tar.gz");
    });

    it("falls back to an older release that still supports the Proton build", () => {
        expect(findBsArm64Release(catalog, "proton-11.0-3-arm64")).toEqual({ release: v040, asset: v040.protonVersions["proton-11.0-3"] });
    });

    it("supports only the Proton builds the catalog lists, matched exactly", () => {
        expect(findBsArm64Release(catalog, "GE-Proton11-7")).toBeUndefined();
        expect(findBsArm64Release(catalog, "proton-11.0-2cd-arm64")).toBeUndefined();
    });

    it("finds nothing without a Proton build", () => {
        expect(findBsArm64Release(catalog, undefined)).toBeUndefined();
    });

    it("downloads only from bs-arm64's own releases", () => {
        expect(bsArm64DownloadUrl({ release: v041, asset: v041.protonVersions["proton-11.0-2c"] }))
            .toBe("https://github.com/DaVarga/bs-arm64/releases/download/v0.4.1/bs-arm64-v0.4.1-proton-11.0-2c.tar.gz");
    });
});

describe("bsArm64ModsUnavailable", () => {
    const v041 = release("v0.4.1", {});

    it("offers mod support for a BSIPA version the release was tested with", () => {
        expect(bsArm64ModsUnavailable(v041, "4.3.7")).toBeUndefined();
    });

    it("installs without mods when there is no BSIPA", () => {
        expect(bsArm64ModsUnavailable(v041, undefined)).toBe(BsArm64ModsUnavailable.NO_BSIPA);
    });

    it("installs without mods for an untested BSIPA version", () => {
        expect(bsArm64ModsUnavailable(v041, "4.3.8")).toBe(BsArm64ModsUnavailable.BSIPA_NOT_SUPPORTED);
    });
});

describe("getCatalog", () => {
    let assets: string;
    let getJSON: jest.Mock;
    const remote = [release("v0.5.0", { "proton-11.0-3": { artifact: "bs-arm64-v0.5.0-proton-11.0-3.tar.gz", sha256: SHA_B } })];
    const bundled = [release("v0.4.1", { "proton-11.0-2c": { artifact: "bs-arm64-v0.4.1-proton-11.0-2c.tar.gz", sha256: SHA_A } })];

    const service = () => {
        (BsArm64Service as unknown as { instance?: BsArm64Service }).instance = undefined;
        const s = BsArm64Service.getInstance() as unknown as Record<string, unknown>;
        s.request = { getJSON };
        s.utils = { getAssestsJsonsPath: () => assets };
        return s as unknown as { getCatalog(o?: { refresh?: boolean }): Promise<BsArm64Release[]> };
    };

    beforeEach(async () => {
        assets = await fs.mkdtemp(path.join(os.tmpdir(), "bsm-arm64-assets-"));
        await fs.outputJson(path.join(assets, "bs-arm64-releases.json"), bundled);
        getJSON = jest.fn(async () => ({ data: remote, headers: {} }));
    });

    afterEach(async () => {
        await fs.remove(assets);
    });

    it("uses the catalog from BSManager's repository", async () => {
        await expect(service().getCatalog()).resolves.toEqual(remote);
        expect(getJSON).toHaveBeenCalledWith(BS_ARM64_RELEASES_URL, expect.objectContaining({ retryLimit: 0 }));
    });

    it("falls back to the bundled catalog when offline", async () => {
        getJSON.mockRejectedValue(new Error("offline"));
        await expect(service().getCatalog()).resolves.toEqual(bundled);
    });

    it("falls back to the bundled catalog when the remote one is invalid", async () => {
        getJSON.mockResolvedValue({ data: [{ version: "v9.9.9", protonVersions: { x: { artifact: "bs-arm64-x.tar.gz" } } }], headers: {} });
        await expect(service().getCatalog()).resolves.toEqual(bundled);
    });

    it("asks again only after a while, or when refreshing before an install", async () => {
        const s = service();
        await s.getCatalog();
        await s.getCatalog();
        expect(getJSON).toHaveBeenCalledTimes(1);
        await s.getCatalog({ refresh: true });
        expect(getJSON).toHaveBeenCalledTimes(2);
    });
});

describe("parseBsArm64InstallerLine", () => {
    it("reads the installer's --json lines", () => {
        expect(parseBsArm64InstallerLine('{"type": "log", "message": "x"}')).toEqual({ type: "log", message: "x" });
        expect(parseBsArm64InstallerLine('{"type": "warning", "message": "w"}')).toEqual({ type: "warning", message: "w" });
        expect(parseBsArm64InstallerLine('{"type": "progress", "percent": 42}')).toEqual({ type: "progress", percent: 42 });
        expect(parseBsArm64InstallerLine('{"type": "error", "code": "PREFIX_BUSY", "message": "busy"}'))
            .toEqual({ type: "error", code: "PREFIX_BUSY", message: "busy" });
        expect(parseBsArm64InstallerLine('{"type": "result", "api": 1, "installed": true, "mods": false, "ready": true}'))
            .toMatchObject({ type: "result", installed: true, mods: false, ready: true });
    });

    it("treats anything else as a log line", () => {
        expect(parseBsArm64InstallerLine("==> done")).toEqual({ type: "log", message: "==> done" });
        expect(parseBsArm64InstallerLine('{"type": "progress"}')).toEqual({ type: "log", message: '{"type": "progress"}' });
        expect(parseBsArm64InstallerLine("[1, 2]")).toEqual({ type: "log", message: "[1, 2]" });
    });
});

describe("lineReader", () => {
    it("joins lines that arrive in several chunks and drops empty ones", () => {
        const lines: string[] = [];
        const reader = lineReader(line => lines.push(line));
        reader.push('{"type": "lo');
        reader.push('g", "message": "a"}\n\nb\r\nc');
        expect(lines).toEqual(['{"type": "log", "message": "a"}', "b"]);
        reader.flush();
        expect(lines).toEqual(['{"type": "log", "message": "a"}', "b", "c"]);
    });
});

describe("runInstaller", () => {
    // A child process that prints `stdout` and exits with `code`
    function fakeChild(stdout: string[], code: number) {
        const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter() });
        setImmediate(() => {
            stdout.forEach(chunk => child.stdout.emit("data", Buffer.from(chunk)));
            child.emit("close", code);
        });
        return child;
    }

    const runInstaller = (args: string[], progress: (p: BsArm64Progress) => void) => {
        (BsArm64Service as unknown as { instance?: BsArm64Service }).instance = undefined;
        const s = BsArm64Service.getInstance() as unknown as {
            runInstaller(dir: string, args: string[], progress: (p: BsArm64Progress) => void): Promise<unknown>;
        };
        return s.runInstaller("/r", args, progress);
    };

    afterEach(() => jest.mocked(bsmSpawn).mockReset());

    it("passes --json, forwards log lines and progress, and returns the result", async () => {
        jest.mocked(bsmSpawn).mockImplementation(() => fakeChild([
            '{"type": "log", "message": "fetching"}\n{"type": "progress", "percent": 50}\n',
            '{"type": "warning", "message": "w"}\n{"type": "result", "installed": true}\n',
        ], 0) as never);
        const progress = jest.fn();
        await expect(runInstaller(["install", "'/i'"], progress)).resolves.toMatchObject({ type: "result", installed: true });
        expect(jest.mocked(bsmSpawn).mock.calls[0][0]).toBe("bash '/r/bs-arm64.sh' install '/i' --json");
        expect(progress.mock.calls.map(c => c[0])).toEqual([{ log: "fetching" }, { percent: 50 }, { log: "warning: w" }]);
    });

    it("fails with the installer's error code", async () => {
        jest.mocked(bsmSpawn).mockImplementation(() => fakeChild([
            '{"type": "error", "code": "PREFIX_BUSY", "message": "Windows programs are still running"}\n',
        ], 1) as never);
        await expect(runInstaller(["install"], () => {})).rejects.toMatchObject({
            code: BsArm64Error.INSTALLER_FAILED,
            data: BsArm64InstallerErrorCode.PREFIX_BUSY,
            message: "Windows programs are still running",
        });
    });
});

describe("getLaunchScript", () => {
    let root: string;
    let instance: string;
    let release: string;
    let status: object | undefined;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), "bsm-arm64-"));
        instance = path.join(root, "instance");
        release = path.join(root, "bs-arm64-v0.4.0-proton-11.0-2c");
        await fs.outputJson(path.join(instance, ".bs-arm64", "bsm-release.json"), { tag: "v0.4.0", dir: release });
        status = { installed: true, mods: true, ready: true };
        jest.spyOn(BsArm64Service.prototype as any, "scriptStatus").mockImplementation(async () => status);
        (BsArm64Service as unknown as { instance?: BsArm64Service }).instance = undefined;
    });

    afterEach(async () => {
        jest.restoreAllMocks();
        await fs.remove(root);
    });

    it("returns the installed release's bs-arm64.sh", async () => {
        await expect(BsArm64Service.getInstance().getLaunchScript(instance)).resolves.toBe(path.join(release, "bs-arm64.sh"));
    });

    it("is undefined for an instance BSManager didn't install the native ARM64 build into", async () => {
        await fs.remove(path.join(instance, ".bs-arm64"));
        await expect(BsArm64Service.getInstance().getLaunchScript(instance)).resolves.toBeUndefined();
    });

    it("asks for a reinstall when the installer says so (e.g. Proton changed)", async () => {
        status = { installed: true, mods: true, ready: false };
        await expect(BsArm64Service.getInstance().getLaunchScript(instance)).rejects.toMatchObject({ code: BSLaunchError.BS_ARM64_OUTDATED });
    });

    it("asks for a reinstall for a release without status (0.3.x and older)", async () => {
        status = undefined;
        await expect(BsArm64Service.getInstance().getLaunchScript(instance)).rejects.toMatchObject({ code: BSLaunchError.BS_ARM64_OUTDATED });
    });
});
