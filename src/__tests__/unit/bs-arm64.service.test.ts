import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { BsArm64Service, bsArm64ModsUnavailable, bsArm64Supported, findBsArm64ReleaseAsset, GithubRelease, parseBsArm64Result } from "main/services/bs-arm64.service";
import { BSLaunchError } from "shared/models/bs-launch";
import { BsArm64Manifest, BsArm64ModsUnavailable } from "shared/models/bs-arm64/bs-arm64.model";

jest.mock("electron", () => ({ app: { getPath: () => "", getVersion: () => "0.0.0" } }));
jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn() } }));
jest.mock("main/services/installation-location.service", () => ({ InstallationLocationService: { getInstance: jest.fn() } }));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn() } }));
jest.mock("main/services/request.service", () => ({ RequestService: { getInstance: jest.fn() } }));
jest.mock("main/services/mods/bs-mods-manager.service", () => ({ BsModsManagerService: { getInstance: jest.fn() } }));

function release(tag: string, protonTags: string[], extra: Partial<GithubRelease> = {}): GithubRelease {
    return {
        tag_name: tag,
        draft: false,
        prerelease: false,
        assets: protonTags.flatMap(p => [
            { name: `bs-arm64-${tag}-${p}.tar.gz`, browser_download_url: `https://x/${tag}/${p}.tar.gz` },
            { name: `bs-arm64-${tag}-${p}.tar.gz.sha256`, browser_download_url: `https://x/${tag}/${p}.sha256` },
        ]),
        ...extra,
    };
}

describe("findBsArm64ReleaseAsset", () => {
    const v040 = release("v0.4.0", ["proton-11.0-2c", "proton-11.0-3"]);
    const manifest: BsArm64Manifest = {
        version: "v0.4.0",
        proton: "proton-11.0-2c",
        protonVersions: {
            "proton-11.0-2c": { artifact: "bs-arm64-v0.4.0-proton-11.0-2c.tar.gz" },
            // Same files as 2c: no asset of its own
            "proton-11.0-2e": { artifact: "bs-arm64-v0.4.0-proton-11.0-2c.tar.gz" },
            "proton-11.0-3": { artifact: "bs-arm64-v0.4.0-proton-11.0-3.tar.gz" },
        },
        unityVersions: ["6000.0.40f1"],
        bsVersions: ["1.44.1"],
        bsipaVersions: ["4.3.7"],
    };

    it("installs the artifact the manifest names for the Proton build", () => {
        expect(findBsArm64ReleaseAsset(v040, manifest, "proton-11.0-2e-arm64")?.asset.name).toBe("bs-arm64-v0.4.0-proton-11.0-2c.tar.gz");
        expect(findBsArm64ReleaseAsset(v040, manifest, "proton-11.0-3-arm64")?.asset.name).toBe("bs-arm64-v0.4.0-proton-11.0-3.tar.gz");
    });

    it("supports only the Proton builds the manifest lists, matched exactly", () => {
        expect(findBsArm64ReleaseAsset(v040, manifest, "GE-Proton11-7")).toBeUndefined();
        expect(findBsArm64ReleaseAsset(v040, manifest, "proton-11.0-2cd-arm64")).toBeUndefined();
    });

    it("finds nothing without a Proton build", () => {
        expect(findBsArm64ReleaseAsset(v040, manifest, undefined)).toBeUndefined();
    });

    it("finds nothing when the named artifact isn't on the release", () => {
        const broken = { ...manifest, protonVersions: { "proton-11.0-2c": { artifact: "missing.tar.gz" } } };
        expect(findBsArm64ReleaseAsset(v040, broken, "proton-11.0-2c-arm64")).toBeUndefined();
    });
});

describe("bs-arm64 manifest", () => {
    const manifest: BsArm64Manifest = {
        version: "v0.3.2",
        proton: "proton-11.0-2c",
        protonVersions: { "proton-11.0-2c": { artifact: "bs-arm64-v0.3.2-proton-11.0-2c.tar.gz" } },
        unityVersions: ["6000.0.40f1"],
        bsVersions: ["1.40.9", "1.41.1", "1.44.1"],
        bsipaVersions: ["4.3.7"],
    };

    it("supports the Beat Saber versions the release lists", () => {
        expect(bsArm64Supported(manifest).bsVersions).toEqual(["1.40.9", "1.41.1", "1.44.1"]);
    });

    it("falls back to 1.44.1 and BSIPA 4.3.7 for releases without a manifest", () => {
        expect(bsArm64Supported(undefined)).toEqual({ bsVersions: ["1.44.1"], bsipaVersions: ["4.3.7"] });
    });

    it("offers mod support for a BSIPA version the release was tested with", () => {
        expect(bsArm64ModsUnavailable(manifest, "4.3.7")).toBeUndefined();
    });

    it("installs without mods when there is no BSIPA", () => {
        expect(bsArm64ModsUnavailable(manifest, undefined)).toBe(BsArm64ModsUnavailable.NO_BSIPA);
    });

    it("installs without mods for an untested BSIPA version", () => {
        expect(bsArm64ModsUnavailable(manifest, "4.3.8")).toBe(BsArm64ModsUnavailable.BSIPA_NOT_SUPPORTED);
        expect(bsArm64ModsUnavailable(undefined, "4.3.8")).toBe(BsArm64ModsUnavailable.BSIPA_NOT_SUPPORTED);
    });
});

describe("parseBsArm64Result", () => {
    it("reads the result line of `bs-arm64.sh status --json`", () => {
        const lines = [
            '{"type": "log", "message": "x"}',
            '{"type": "result", "api": 1, "installed": true, "mods": false, "ready": true, "protonBuild": "proton-11.0-2e-arm64"}',
        ];
        expect(parseBsArm64Result(lines)).toMatchObject({ installed: true, mods: false, ready: true });
    });

    it("finds nothing without a result line", () => {
        expect(parseBsArm64Result(["==> done", '{"type": "error", "code": "NOT_AN_INSTANCE", "message": "x"}'])).toBeUndefined();
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
