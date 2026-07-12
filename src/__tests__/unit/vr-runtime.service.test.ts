import { loadRegistryList, VrRuntimeService } from "main/services/vr-runtime.service";
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
    it("degrades to an unavailable registry when the native binding cannot load", () => {
        const loadRegistryModule = jest.fn(() => {
            throw new Error("native binding unavailable");
        });

        expect(loadRegistryList("win32", loadRegistryModule)).toBeUndefined();
    });

    it("returns UNKNOWN without querying the registry on non-Windows platforms", async () => {
        const registryList = jest.fn();
        const service = new VrRuntimeService({ platform: "linux", registryList });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.UNKNOWN);
        expect(registryList).not.toHaveBeenCalled();
    });

    it("honors XR_RUNTIME_JSON on non-Windows platforms", async () => {
        const registryList = jest.fn();
        const pathExists = jest.fn().mockReturnValue(true);
        const service = new VrRuntimeService({
            platform: "linux",
            registryList,
            pathExists,
            environment: { XR_RUNTIME_JSON: "/opt/steamvr/steamxr_linux64.json" },
        });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.STEAM);
        expect(registryList).not.toHaveBeenCalled();
    });

    it("returns UNKNOWN when the registry cannot be read", async () => {
        const registryList = jest.fn().mockRejectedValue(new Error("access denied"));
        const service = new VrRuntimeService({ platform: "win32", registryList });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.UNKNOWN);
    });

    it("uses XR_RUNTIME_JSON instead of the registry runtime", async () => {
        const registryList = jest.fn().mockResolvedValue(registryValue("C:\\SteamVR\\steamxr_win64.json"));
        const pathExists = jest.fn().mockReturnValue(true);
        const service = new VrRuntimeService({
            platform: "win32",
            registryList,
            pathExists,
            environment: { XR_RUNTIME_JSON: "C:\\Virtual Desktop\\openxr.json" },
        });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.VDXR);
        expect(pathExists).toHaveBeenCalledWith("C:\\Virtual Desktop\\openxr.json");
        expect(registryList).not.toHaveBeenCalled();
    });

    it("prefers a launch-specific XR_RUNTIME_JSON override over the process environment", async () => {
        const registryList = jest.fn();
        const pathExists = jest.fn().mockReturnValue(true);
        const service = new VrRuntimeService({
            platform: "win32",
            registryList,
            pathExists,
            environment: { XR_RUNTIME_JSON: "C:\\SteamVR\\steamxr_win64.json" },
        });

        await expect(service.getActiveRuntime({ XR_RUNTIME_JSON: "C:\\VirtualDesktop\\vdxr.json" }))
            .resolves.toBe(VrRuntime.VDXR);
        expect(pathExists).toHaveBeenCalledWith("C:\\VirtualDesktop\\vdxr.json");
        expect(registryList).not.toHaveBeenCalled();
    });

    it("honors a case-insensitive XR_RUNTIME_JSON override when the registry is unavailable", async () => {
        const registryList = jest.fn().mockRejectedValue(new Error("registry unavailable"));
        const pathExists = jest.fn().mockReturnValue(true);
        const service = new VrRuntimeService({
            platform: "win32",
            registryList,
            pathExists,
            environment: { xr_runtime_json: "%RUNTIME_HOME%\\meta_openxr_64.json", runtime_home: "C:\\Meta" },
        });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.OCULUS);
        expect(pathExists).toHaveBeenCalledWith("C:\\Meta\\meta_openxr_64.json");
        expect(registryList).not.toHaveBeenCalled();
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

    it("returns UNKNOWN when the runtime manifest cannot be validated", async () => {
        const registryList = jest.fn().mockResolvedValue(registryValue("C:\\SteamVR\\steamxr_win64.json"));
        const pathExists = jest.fn(() => { throw new Error("filesystem unavailable"); });
        const service = new VrRuntimeService({ platform: "win32", registryList, pathExists });

        await expect(service.getActiveRuntime()).resolves.toBe(VrRuntime.UNKNOWN);
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
