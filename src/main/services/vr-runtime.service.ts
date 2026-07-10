import log from "electron-log";
import { pathExistsSync } from "fs-extra";
import { execOnOs } from "main/helpers/env.helpers";
import { parseOpenXrRuntimePath } from "shared/helpers/vr-runtime.helpers";
import { VrRuntime } from "shared/models/vr-runtime.model";

type RegistryKeyData = {
    values?: {
        ActiveRuntime?: { value?: unknown };
    };
};

type RegistryList = (key: string) => Promise<Record<string, RegistryKeyData>>;

type VrRuntimeServiceOptions = {
    platform?: NodeJS.Platform;
    registryList?: RegistryList;
    pathExists?: (path: string) => boolean;
    environment?: NodeJS.ProcessEnv;
};

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as { list?: RegistryList };

export class VrRuntimeService {
    private static instance: VrRuntimeService;

    private readonly platform: NodeJS.Platform;
    private readonly registryList?: RegistryList;
    private readonly pathExists: (path: string) => boolean;
    private readonly environment: NodeJS.ProcessEnv;

    public constructor(options: VrRuntimeServiceOptions = {}) {
        this.platform = options.platform ?? process.platform;
        this.registryList = options.registryList ?? list;
        this.pathExists = options.pathExists ?? pathExistsSync;
        this.environment = options.environment ?? process.env;
    }

    public static getInstance(): VrRuntimeService {
        if (!VrRuntimeService.instance) {
            VrRuntimeService.instance = new VrRuntimeService();
        }
        return VrRuntimeService.instance;
    }

    public async getActiveRuntime(): Promise<VrRuntime> {
        if (this.platform !== "win32") {
            return VrRuntime.UNKNOWN;
        }

        const registryKey = "HKLM\\SOFTWARE\\Khronos\\OpenXR\\1";
        if (!this.registryList) {
            return VrRuntime.UNKNOWN;
        }
        const registryData = await this.registryList(registryKey)
            .then(data => data[registryKey])
            .catch((error: unknown): null => {
                log.warn("Unable to read the active OpenXR runtime", error);
                return null;
            });

        if (registryData === null) {
            return VrRuntime.UNKNOWN;
        }

        const activeRuntimePath = registryData?.values?.ActiveRuntime?.value;
        if (typeof activeRuntimePath !== "string") {
            return VrRuntime.NOT_SET;
        }

        const expandedRuntimePath = activeRuntimePath.replace(/%([^%]+)%/g, (match, variableName: string) => {
            const environmentKey = Object.keys(this.environment)
                .find(key => key.toLowerCase() === variableName.toLowerCase());
            return environmentKey ? this.environment[environmentKey] : match;
        });

        if (!this.pathExists(expandedRuntimePath)) {
            return VrRuntime.NOT_SET;
        }

        return parseOpenXrRuntimePath(expandedRuntimePath);
    }
}
