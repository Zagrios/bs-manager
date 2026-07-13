import { lastValueFrom } from "rxjs";
import { pathExists } from "fs-extra";
import { isProcessRunning } from "main/helpers/os.helpers";
import { OculusLauncherService } from "main/services/bs-launcher/oculus-launcher.service";
import { BSLaunchError, LaunchOption } from "shared/models/bs-launch";
import path from "path";
import log from "electron-log";

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("fs-extra", () => ({ pathExists: jest.fn() }));
jest.mock("main/constants", () => ({ BS_EXECUTABLE: "Beat Saber.exe", IS_FLATPAK: false }));
jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    getProcessesByName: jest.fn(),
    isProcessRunning: jest.fn(),
}));
jest.mock("main/helpers/launchOptions.helper", () => ({
    parseLaunchOptions: jest.fn(() => ({ env: {}, cmdlet: "Beat Saber.exe", args: "" })),
}));
jest.mock("main/services/oculus.service", () => ({ OculusService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/static-configuration.service", () => ({
    StaticConfigurationService: { getInstance: jest.fn(() => ({ get: jest.fn(() => false) })) },
}));

describe("OculusLauncherService owned process lifecycle", () => {
    const launchOptions: LaunchOption = {
        version: { BSVersion: "1.29.1", oculus: true },
    };
    const snapshot = {
        existingProcessIds: new Set<number>(),
        launchedAfter: new Date("2026-07-13T08:00:00.000Z"),
    };
    const identity = {
        pid: 85,
        startedAt: new Date("2026-07-13T08:00:00.001Z"),
    };

    function buildService(ownership: unknown, exit: Promise<number> = Promise.resolve(0)) {
        const service = Object.create(OculusLauncherService.prototype) as OculusLauncherService;
        const { signal } = new AbortController();
        const createProcessOwnershipSnapshot = jest.fn().mockResolvedValue(snapshot);
        const launchBeatSaber = jest.fn(() => ({
            process: {},
            exit,
            ownership: Promise.resolve(ownership),
            signal,
        }));
        const waitForOwnedProcessExit = jest.fn().mockResolvedValue(true);
        Object.assign(service as any, {
            createProcessOwnershipSnapshot,
            launchBeatSaber,
            localVersions: { getInstalledVersionPath: jest.fn().mockResolvedValue("C:/Beat Saber") },
            oculus: { startOculus: jest.fn().mockResolvedValue(undefined) },
            waitForOwnedProcessExit,
        });
        return { service, createProcessOwnershipSnapshot, launchBeatSaber, waitForOwnedProcessExit };
    }

    function deferred<T>() {
        let resolveDeferred!: (value: T | PromiseLike<T>) => void;
        let rejectDeferred!: (reason?: unknown) => void;
        const promise = new Promise<T>((resolve, reject) => {
            resolveDeferred = resolve;
            rejectDeferred = reject;
        });
        return { promise, resolve: resolveDeferred, reject: rejectDeferred };
    }

    async function flushPromises(): Promise<void> {
        for (let attempt = 0; attempt < 8; attempt++) {
            await Promise.resolve();
        }
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (pathExists as jest.Mock).mockResolvedValue(true);
        (isProcessRunning as jest.Mock).mockResolvedValue(false);
    });

    it("binds completion to the safely owned Oculus process", async () => {
        const { service, createProcessOwnershipSnapshot, launchBeatSaber, waitForOwnedProcessExit } = buildService(identity);

        await lastValueFrom(service.launch(launchOptions));

        expect(createProcessOwnershipSnapshot).toHaveBeenCalledTimes(1);
        expect(launchBeatSaber).toHaveBeenCalledWith(expect.any(Object), snapshot);
        expect(waitForOwnedProcessExit).toHaveBeenCalledWith(
            path.join("C:/Beat Saber", "Beat Saber.exe"),
            identity,
            expect.any(AbortSignal)
        );
    });

    it("fails safe when Oculus ownership is unavailable instead of watching another process", async () => {
        const { service, waitForOwnedProcessExit } = buildService(undefined);

        await lastValueFrom(service.launch(launchOptions));

        expect(waitForOwnedProcessExit).not.toHaveBeenCalled();
        expect(isProcessRunning).toHaveBeenCalledTimes(1);
    });

    it("consumes a late wrapper error after the owned process branch completes", async () => {
        const wrapperExit = deferred<number>();
        const wrapperError = new Error("late wrapper failure");
        const { service, waitForOwnedProcessExit } = buildService(identity, wrapperExit.promise);

        await lastValueFrom(service.launch(launchOptions));

        expect(waitForOwnedProcessExit).toHaveBeenCalledTimes(1);
        wrapperExit.reject(wrapperError);
        await flushPromises();

        expect(log.error).toHaveBeenCalledWith(
            "BS wrapper process failed after Oculus process ownership was acquired",
            wrapperError
        );
    });

    it("preserves BS_EXIT_ERROR when wrapper exit fails without an owned process", async () => {
        const wrapperExit = deferred<number>();
        const wrapperError = new Error("wrapper failure");
        const { service, launchBeatSaber } = buildService(undefined, wrapperExit.promise);
        const launch = lastValueFrom(service.launch(launchOptions));
        await flushPromises();
        expect(launchBeatSaber).toHaveBeenCalledTimes(1);

        wrapperExit.reject(wrapperError);

        await expect(launch).rejects.toMatchObject({
            code: BSLaunchError.BS_EXIT_ERROR,
            message: wrapperError.message,
        });
    });
});
