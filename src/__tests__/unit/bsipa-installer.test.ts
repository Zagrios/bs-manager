import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { backupName, BsipaInstallErrorCode, installBsipa, readFileVersion, revertBsipa } from "main/services/mods/bsipa-installer";

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

// A binary whose version resource says `version` (VS_FIXEDFILEINFO at a DWORD-aligned offset)
function binaryWithVersion([a, b, c, d]: number[], padding = 64): Buffer {
    const block = Buffer.alloc(16);
    block.writeUInt32LE(0xfeef04bd, 0);
    block.writeUInt32LE(0x00010000, 4);
    block.writeUInt32LE(((a << 16) | b) >>> 0, 8);
    block.writeUInt32LE(((c << 16) | d) >>> 0, 12);
    return Buffer.concat([Buffer.alloc(padding, 0x41), block, Buffer.alloc(32)]);
}

const T0 = new Date(2026, 10, 28, 13, 5, 9);

describe("BSIPA installer", () => {
    let game: string;

    const file = (rel: string) => path.join(game, ...rel.split("/"));
    const read = (rel: string) => fs.readFile(file(rel), "utf8");
    const exists = (rel: string) => fs.pathExists(file(rel));
    const write = (rel: string, content: string | Buffer, mtime?: Date) => fs.outputFile(file(rel), content).then(() => mtime && fs.utimes(file(rel), mtime, mtime));
    const backups = () => fs.readdir(file("IPA/Backups/Beat Saber")).catch((): string[] => []);
    const manifest = async () => {
        const [name] = await backups();
        return fs.readFile(file(`IPA/Backups/Beat Saber/${name}/$manifest$.txt`), "utf8");
    };

    // The BSIPA package as BSManager extracts it into the game folder
    async function extractPackage(version = [4, 3, 7, 0], content = "new") {
        await write("IPA.exe", "exe");
        await write("IPA/winhttp.dll", `doorstop ${content}`);
        await write("IPA/Data/Managed/IPA.Injector.dll", binaryWithVersion(version));
        await write("IPA/Data/Managed/IPA.Loader.dll", `loader ${content}`);
        await write("IPA/Libs/0Harmony.dll", `harmony ${content}`);
        await write("IPA/Libs/Sub/Deep.dll", `deep ${content}`);
    }

    beforeEach(async () => {
        game = await fs.mkdtemp(path.join(os.tmpdir(), "bsm-bsipa-"));
        await write("Beat Saber.exe", "game");
        await write("Beat Saber_Data/Managed/UnityEngine.CoreModule.dll", "unity");
        await write("Beat Saber_Data/Managed/Assembly-CSharp.dll", "game code");
        // A file BSIPA overwrites, and the user's own empty folder
        await write("Libs/0Harmony.dll", "user harmony");
        await fs.ensureDir(file("Beat Saber_Data/CustomLevels"));
    });

    afterEach(async () => {
        await fs.remove(game);
    });

    it("copies the package into the game like IPA.exe and creates Plugins", async () => {
        await extractPackage();
        await installBsipa(game, { now: T0 });

        expect(await read("winhttp.dll")).toBe("doorstop new");
        expect(await read("Beat Saber_Data/Managed/IPA.Loader.dll")).toBe("loader new");
        expect(await read("Libs/0Harmony.dll")).toBe("harmony new");
        expect(await read("Libs/Sub/Deep.dll")).toBe("deep new");
        expect(await exists("Plugins")).toBe(true);
        // Only files directly in IPA/ go to the game folder
        expect(await exists("Data")).toBe(false);
        expect(await exists("Libs/Libs")).toBe(false);
    });

    it("writes the backup in IPA.exe's format", async () => {
        await extractPackage();
        await installBsipa(game, { now: T0 });

        expect(await backups()).toEqual(["2026-11-28_1-05-09"]);
        expect((await manifest()).split("\r\n").filter(Boolean).sort()).toEqual([
            "Beat Saber_Data\\Managed\\IPA.Injector.dll",
            "Beat Saber_Data\\Managed\\IPA.Loader.dll",
            "Libs\\0Harmony.dll",
            "Libs\\Sub\\Deep.dll",
            "winhttp.dll",
        ]);
        expect(await manifest()).toMatch(/\r\n$/);
        // The overwritten file is kept, added files have no copy
        expect(await read("IPA/Backups/Beat Saber/2026-11-28_1-05-09/Libs/0Harmony.dll")).toBe("user harmony");
        expect(await fs.pathExists(file("IPA/Backups/Beat Saber/2026-11-28_1-05-09/winhttp.dll"))).toBe(false);
    });

    it("keeps the package's timestamps, as IPA.exe's copy does", async () => {
        const old = new Date(2025, 0, 1);
        await extractPackage();
        await fs.utimes(file("IPA/Libs/0Harmony.dll"), old, old);
        await installBsipa(game, { now: T0 });
        expect((await fs.stat(file("Libs/0Harmony.dll"))).mtime.getTime()).toBe(old.getTime());
    });

    it("reverts to the original files and removes only the folders it emptied", async () => {
        await extractPackage();
        await installBsipa(game, { now: T0 });
        await write("Beat Saber (Patch & Launch).lnk", "shortcut");

        await expect(revertBsipa(game)).resolves.toBe(true);

        expect(await read("Libs/0Harmony.dll")).toBe("user harmony");
        expect(await exists("winhttp.dll")).toBe(false);
        expect(await exists("Beat Saber_Data/Managed/IPA.Loader.dll")).toBe(false);
        expect(await exists("Libs/Sub")).toBe(false);
        expect(await exists("Beat Saber (Patch & Launch).lnk")).toBe(false);
        expect(await backups()).toEqual([]);
        // BSIPA's own empty folders go, as with IPA.exe
        expect(await exists("Plugins")).toBe(false);
        expect(await exists("IPA/Backups")).toBe(false);
        // Game files and the user's empty folder stay (IPA.exe would delete every empty folder)
        expect(await read("Beat Saber_Data/Managed/Assembly-CSharp.dll")).toBe("game code");
        expect(await exists("Beat Saber_Data/CustomLevels")).toBe(true);
    });

    it("keeps Plugins when the user has plugins in it", async () => {
        await extractPackage();
        await installBsipa(game, { now: T0 });
        await write("Plugins/SongCore.dll", "plugin");
        await revertBsipa(game);
        expect(await read("Plugins/SongCore.dll")).toBe("plugin");
    });

    it("says when there's nothing to revert", async () => {
        await expect(revertBsipa(game)).resolves.toBe(false);
    });

    it("reverts the previous install before installing again, keeping one backup", async () => {
        await extractPackage([4, 3, 6, 0], "old");
        await installBsipa(game, { now: T0 });
        await extractPackage([4, 3, 7, 0], "new");
        await installBsipa(game, { now: new Date(2026, 10, 28, 14, 0, 0) });

        expect(await read("Libs/0Harmony.dll")).toBe("harmony new");
        expect(await backups()).toEqual(["2026-11-28_2-00-00"]);
        // The backup holds the user's file, not the first install's
        expect(await read("IPA/Backups/Beat Saber/2026-11-28_2-00-00/Libs/0Harmony.dll")).toBe("user harmony");
        await revertBsipa(game);
        expect(await read("Libs/0Harmony.dll")).toBe("user harmony");
    });

    it("leaves a newer installed BSIPA alone", async () => {
        await write("winhttp.dll", "doorstop newer");
        await write("Beat Saber_Data/Managed/IPA.Injector.dll", binaryWithVersion([4, 4, 0, 0]));
        await extractPackage([4, 3, 7, 0]);

        await installBsipa(game, { now: T0 });

        expect(await read("winhttp.dll")).toBe("doorstop newer");
        expect(await backups()).toEqual([]);
        expect(await exists("Plugins")).toBe(true);
    });

    it("reverts an install made by IPA.exe (backslash manifest)", async () => {
        await write("winhttp.dll", "doorstop");
        await write("Libs/0Harmony.dll", "bsipa harmony");
        const dir = "IPA/Backups/Beat Saber/2026-11-01_9-00-00";
        await write(`${dir}/Libs/0Harmony.dll`, "user harmony");
        await write(`${dir}/$manifest$.txt`, "winhttp.dll\r\nLibs\\0Harmony.dll\r\n");

        await expect(revertBsipa(game)).resolves.toBe(true);
        expect(await exists("winhttp.dll")).toBe(false);
        expect(await read("Libs/0Harmony.dll")).toBe("user harmony");
    });

    it("reverts a backup without manifest from the files it holds, as IPA.exe does", async () => {
        await write("Libs/0Harmony.dll", "bsipa harmony");
        await write("IPA/Backups/Beat Saber/2026-11-01_9-00-00/Libs/0Harmony.dll", "user harmony");
        await revertBsipa(game);
        expect(await read("Libs/0Harmony.dll")).toBe("user harmony");
    });

    it("deletes files whose backup is empty, as IPA.exe does", async () => {
        await write("Libs/Empty.dll", "bsipa");
        await write("IPA/Backups/Beat Saber/2026-11-01_9-00-00/Libs/Empty.dll", "");
        await write("IPA/Backups/Beat Saber/2026-11-01_9-00-00/$manifest$.txt", "Libs\\Empty.dll\r\n");
        await revertBsipa(game);
        expect(await exists("Libs/Empty.dll")).toBe(false);
    });

    it("ignores manifest entries outside the game folder", async () => {
        const outside = path.join(path.dirname(game), `${path.basename(game)}-outside.txt`);
        await fs.outputFile(outside, "keep");
        await write("IPA/Backups/Beat Saber/2026-11-01_9-00-00/$manifest$.txt", `..\\${path.basename(outside)}\r\nC:\\Windows\\win.ini\r\n${outside}\r\n`);
        try {
            await revertBsipa(game);
            expect(await fs.readFile(outside, "utf8")).toBe("keep");
        } finally {
            await fs.remove(outside);
        }
    });

    it("refuses a folder that isn't a Unity game, and a missing package", async () => {
        await extractPackage();
        await fs.remove(file("Beat Saber_Data/Managed/UnityEngine.CoreModule.dll"));
        await expect(installBsipa(game)).rejects.toMatchObject({ code: BsipaInstallErrorCode.NOT_A_UNITY_GAME });

        await write("Beat Saber_Data/Managed/UnityEngine.CoreModule.dll", "unity");
        await fs.remove(file("IPA/Libs"));
        await expect(installBsipa(game)).rejects.toMatchObject({ code: BsipaInstallErrorCode.MISSING_PACKAGE });
    });
});

describe("readFileVersion", () => {
    it("reads the version block of a Windows binary", () => {
        expect(readFileVersion(binaryWithVersion([4, 3, 7, 0]))).toEqual([4, 3, 7, 0]);
        expect(readFileVersion(binaryWithVersion([65535, 1, 2, 65535], 128))).toEqual([65535, 1, 2, 65535]);
    });

    it("skips matches that aren't DWORD-aligned, and finds nothing without a block", () => {
        expect(readFileVersion(binaryWithVersion([1, 2, 3, 4], 66))).toBeUndefined();
        expect(readFileVersion(Buffer.from("no version here"))).toBeUndefined();
    });
});

describe("backupName", () => {
    it("formats like IPA.exe's yyyy-MM-dd_h-mm-ss (12-hour clock)", () => {
        expect(backupName(new Date(2026, 0, 2, 0, 3, 4))).toBe("2026-01-02_12-03-04");
        expect(backupName(new Date(2026, 11, 31, 23, 59, 59))).toBe("2026-12-31_11-59-59");
        expect(backupName(new Date(2026, 5, 6, 9, 10, 11))).toBe("2026-06-06_9-10-11");
    });
});
