import log from "electron-log";
import { execOnOs } from "main/helpers/env.helpers";
import { parseOpenXrRuntimePath } from "shared/helpers/vr-runtime.helpers";
import { VrRuntime } from "shared/models/vr-runtime.model";

type RegistryKeyData = {
    values?: {
        ActiveRuntime?: { value?: unknown };
    };
};

type RegistryList = (key: string) => Promise<Record<string, RegistryKeyData>>;

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as { list?: RegistryList };

export class VrRuntimeService {
    private static instance: VrRuntimeService;

    public static getInstance(): VrRuntimeService {
        if (!VrRuntimeService.instance) {
            VrRuntimeService.instance = new VrRuntimeService();
        }
        return VrRuntimeService.instance;
    }

    public async getActiveRuntime(): Promise<VrRuntime> {
        if (process.platform !== "win32") {
            return VrRuntime.UNKNOWN;
        }

        const registryKey = "HKLM\\SOFTWARE\\Khronos\\OpenXR\\1";
        if (!list) {
            return VrRuntime.UNKNOWN;
        }
        const registryData = await list(registryKey)
            .then(data => data[registryKey])
            .catch((error: unknown): null => {
                log.warn("Unable to read the active OpenXR runtime", error);
                return null;
            });

        if (registryData === null) {
            return VrRuntime.UNKNOWN;
        }

        const activeRuntimePath = registryData?.values?.ActiveRuntime?.value;

        return parseOpenXrRuntimePath(typeof activeRuntimePath === "string" ? activeRuntimePath : undefined);
    }
}
