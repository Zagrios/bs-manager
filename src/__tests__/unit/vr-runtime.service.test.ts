import { VrRuntimeService } from "main/services/vr-runtime.service";
import { VrRuntime } from "shared/models/vr-runtime.model";

jest.mock("electron-log", () => ({
    warn: jest.fn(),
}));

const registryKey = "HKLM\\SOFTWARE\\Khronos\\OpenXR\\1";

function registryValue(value?: unknown) {
    return {
        [registryKey]: {
            values: {
                ActiveRuntime: { value },
            },
        },
    };
}

describe("VrRuntimeService.getActiveRuntime", () => {
    it("returns UNKNOWN without querying the registry on non-Windows platforms", async () => {
        const registryList = jest.fn();
        const service = new VrRuntimeService({ platform: "linux", registryList });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.UNKNOWN);
        expect(registryList).not.toHaveBeenCalled();
    });

    it("returns UNKNOWN when the registry cannot be read", async () => {
        const registryList = jest.fn().mockRejectedValue(new Error("access denied"));
        const service = new VrRuntimeService({ platform: "win32", registryList });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.UNKNOWN);
    });

    it("returns NOT_SET when the registry value is missing", async () => {
        const registryList = jest.fn().mockResolvedValue(registryValue());
        const service = new VrRuntimeService({ platform: "win32", registryList });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.NOT_SET);
    });

    it("returns NOT_SET when the registered manifest does not exist", async () => {
        const registryList = jest.fn().mockResolvedValue(registryValue("C:\\missing\\steamxr_win64.json"));
        const pathExists = jest.fn().mockReturnValue(false);
        const service = new VrRuntimeService({ platform: "win32", registryList, pathExists });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.NOT_SET);
        expect(pathExists).toHaveBeenCalledWith("C:\\missing\\steamxr_win64.json");
    });

    it("expands environment variables before validating and classifying the manifest", async () => {
        const registryList = jest.fn().mockResolvedValue(registryValue("%LOCALAPPDATA%\\SteamVR\\steamxr_win64.json"));
        const pathExists = jest.fn().mockReturnValue(true);
        const service = new VrRuntimeService({
            platform: "win32",
            registryList,
            pathExists,
            environment: { LOCALAPPDATA: "C:\\Users\\tester\\AppData\\Local" },
        });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.STEAM);
        expect(pathExists).toHaveBeenCalledWith("C:\\Users\\tester\\AppData\\Local\\SteamVR\\steamxr_win64.json");
    });
});
