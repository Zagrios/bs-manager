import { OculusLauncherService } from "main/services/bs-launcher/oculus-launcher.service";
import { isProcessRunning } from "main/helpers/os.helpers";

jest.mock("electron-log", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("main/helpers/os.helpers", () => ({
    BsmShellLog: { Command: 1 },
    bsmSpawn: jest.fn(),
    isProcessRunning: jest.fn(),
}));
jest.mock("main/services/oculus.service", () => ({ OculusService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/linux.service", () => ({ LinuxService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/services/bs-local-version.service", () => ({ BSLocalVersionService: { getInstance: jest.fn(() => ({})) } }));
jest.mock("main/constants", () => ({ BS_EXECUTABLE: "Beat Saber.exe", IS_FLATPAK: false }));

describe("OculusLauncherService process lifecycle", () => {
    it("waits for Beat Saber after the launcher child exits", async () => {
        jest.useFakeTimers();
        (isProcessRunning as jest.Mock)
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        const service = Object.create(OculusLauncherService.prototype) as OculusLauncherService;

        let settled = false;
        const exit = (service as any).waitForBeatSaberExit().then(() => {
            settled = true;
        });

        await Promise.resolve();
        expect(settled).toBe(false);

        await jest.advanceTimersByTimeAsync(1_000);
        await exit;
        expect(isProcessRunning).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });
});
