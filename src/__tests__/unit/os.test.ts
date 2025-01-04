import {
    bsmSpawn,
    // bsmExec,
    isProcessRunning,
    // getProcessId,
} from "main/helpers/os.helpers";

import cp from "child_process";
import crypto from "crypto";
import log from "electron-log";
import { ifDescribe, ifIt } from "__tests__/utils";
import { BS_APP_ID } from "main/constants";

Object.defineProperty(global, "crypto", {
    value: {
        randomUUID: () => crypto.webcrypto.randomUUID(),
    }
});
jest.mock("electron", () => ({
    app: { getPath: () => "" },
}));
jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));
jest.mock("ps-list", () => () => []);

const IS_WINDOWS = process.platform === "win32";
const IS_LINUX = process.platform === "linux";

describe("Test os.helpers bsmSpawn", () => {
    const spawnSpy: jest.SpyInstance = jest.spyOn(cp, "spawn")
        .mockImplementation();
    const logSpy: jest.SpyInstance = jest.spyOn(log, "info");
    const originalContainer = process.env.container;

    const BS_ENV = {
        SteamAppId: BS_APP_ID,
        SteamOverlayGameId: BS_APP_ID,
        SteamGameId: BS_APP_ID,
    };

    beforeAll(() => {
        if (IS_LINUX) {
            Object.assign(BS_ENV, {
                WINEDLLOVERRIDES: "winhttp=n,b",
                STEAM_COMPAT_DATA_PATH: "/compatdata",
                STEAM_COMPAT_INSTALL_PATH: "/BSInstance",
                STEAM_COMPAT_CLIENT_INSTALL_PATH: "/steam",
                STEAM_COMPAT_APP_ID: BS_APP_ID,
                SteamEnv: "1",
            });
        }
    });

    afterAll(() => {
        spawnSpy.mockRestore();
    });

    afterEach(() => {
        spawnSpy.mockClear();
        logSpy.mockClear();
        process.env.container = originalContainer;
    });

    it("Simple spawn command", () => {
        bsmSpawn("cd", {
            args: ["folder1", "folder2"],
        });
        expect(spawnSpy).toHaveBeenCalledTimes(1);
        expect(spawnSpy).toHaveBeenCalledWith("cd folder1 folder2", expect.anything());

        expect(logSpy).toHaveBeenCalledTimes(0);
    });

    it("Simple spawn command with logging", () => {
        bsmSpawn("mkdir", {
            args: ["new_folder"],
            log: true,
        });
        expect(spawnSpy).toHaveBeenCalledTimes(1);
        expect(spawnSpy).toHaveBeenCalledWith("mkdir new_folder", expect.anything());

        expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("Complex spawn command call (Mods install)", () => {
        bsmSpawn(`"./BSIPA.exe" "./Beat Saber.exe" -n`, {
            log: true,
            linux: { prefix: `"./wine64"` },
        });

        expect(spawnSpy).toHaveBeenCalledTimes(1);
        expect(spawnSpy).toHaveBeenCalledWith(
            process.platform === "win32"
                ? `"./BSIPA.exe" "./Beat Saber.exe" -n`
                : `"./wine64" "./BSIPA.exe" "./Beat Saber.exe" -n`,
            expect.anything()
        );

        expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("Complex spawn command call (BS launch)", () => {
        bsmSpawn(`"./Beat Saber.exe"`, {
            args: ["--no-yeet", "fpfc"],
            options: {
                cwd: "/",
                detached: true,
                env: BS_ENV,
            },
            log: true,
            linux: { prefix: `"./proton" run` },
        });

        expect(spawnSpy).toHaveBeenCalledTimes(1);
        expect(spawnSpy).toHaveBeenCalledWith(
            IS_WINDOWS
                ? `"./Beat Saber.exe" --no-yeet fpfc`
                : `"./proton" run "./Beat Saber.exe" --no-yeet fpfc`,
            expect.objectContaining({
                cwd: "/",
                detached: true,
                env: BS_ENV,
            })
        );

        expect(logSpy).toHaveBeenCalledTimes(1);
    });

    ifIt(IS_LINUX)("Complex spawn command call (BS launch flatpak)", () => {
        const flatpakEnv = [
            "SteamAppId",
            "SteamOverlayGameId",
            "SteamGameId",
            "WINEDLLOVERRIDES",
            "STEAM_COMPAT_DATA_PATH",
            "STEAM_COMPAT_INSTALL_PATH",
            "STEAM_COMPAT_CLIENT_INSTALL_PATH",
            "STEAM_COMPAT_APP_ID",
            "SteamEnv"
        ];
        const newEnv = {
            ...BS_ENV,
            something: "else",
            more: "tests",
        };
        bsmSpawn(`"./Beat Saber.exe"`, {
            args: ["--no-yeet", "fpfc"],
            options: {
                cwd: "/",
                detached: true,
                env: newEnv,
            },
            log: true,
            linux: { prefix: `"./proton" run` },
            flatpak: {
                host: true,
                env: flatpakEnv,
            },
        });

        expect(spawnSpy).toHaveBeenCalledTimes(1);
        const envArgs = flatpakEnv.map(argName =>
                `--env=${argName}="${(BS_ENV as any)[argName]}"`
            ).join(" ");
        expect(spawnSpy).toHaveBeenCalledWith(
            `flatpak-spawn --host ${envArgs} "./proton" run "./Beat Saber.exe" --no-yeet fpfc`,
            expect.objectContaining({
                cwd: "/",
                detached: true,
                env: newEnv,
            })
        );

        expect(logSpy).toHaveBeenCalledTimes(1);
    });
});

ifDescribe(IS_LINUX)("Test os.helpers isProcessRunning", () => {
    const logSpy: jest.SpyInstance = jest.spyOn(log, "error");
    afterEach(() => {
        logSpy.mockClear();
    });

    it("Process is running", async () => {
        // There will always a node process running
        const running = await isProcessRunning("node");
        expect(running).toBe(true);

        // No errors received
        expect(logSpy).toHaveBeenCalledTimes(0);
    });

    it("Process is not running", async () => {
        const running = await isProcessRunning(`bs-manager-${crypto.randomUUID()}`);
        expect(running).toBe(false);

        // Throws because grep couldn't find any process with that name
        expect(logSpy).toHaveBeenCalledTimes(1);
    });

    it("Empty process name", async () => {
        const running = await isProcessRunning("");
        expect(running).toBe(false);
        expect(logSpy).toHaveBeenCalledTimes(0);
    })
});

