import log from "electron-log";
import { pathExistsSync } from "fs-extra";
import { parseOpenXrRuntimePath } from "shared/helpers/vr-runtime.helpers";
import { VrRuntime } from "shared/models/vr-runtime.model";

type RegistryKeyData = {
    values?: {
        ActiveRuntime?: { value?: unknown };
    };
};

type RegistryList = (key: string) => Promise<Record<string, RegistryKeyData>>;
type RegistryModuleLoader = () => { list?: RegistryList };

type VrRuntimeServiceOptions = {
    platform?: NodeJS.Platform;
    registryList?: RegistryList;
    pathExists?: (path: string) => boolean;
    environment?: NodeJS.ProcessEnv;
};

export function loadRegistryList(
    platform: NodeJS.Platform = process.platform,
    loadRegistryModule: RegistryModuleLoader = () => require("regedit-rs") as { list?: RegistryList },
): RegistryList | undefined {
    if (platform !== "win32") {
        return undefined;
    }

    try {
        return loadRegistryModule()?.list;
    } catch (error) {
        log.warn("Unable to load the Windows registry binding", error);
        return undefined;
    }
}

export class VrRuntimeService {
    private static instance: VrRuntimeService;

    private readonly platform: NodeJS.Platform;
    private readonly registryList?: RegistryList;
    private readonly pathExists: (path: string) => boolean;
    private readonly environment: NodeJS.ProcessEnv;

    public constructor(options: VrRuntimeServiceOptions = {}) {
        this.platform = options.platform ?? process.platform;
        this.registryList = options.registryList ?? loadRegistryList(this.platform);
        this.pathExists = options.pathExists ?? pathExistsSync;
        this.environment = options.environment ?? process.env;
    }

    public static getInstance(): VrRuntimeService {
        if (!VrRuntimeService.instance) {
            VrRuntimeService.instance = new VrRuntimeService();
        }
        return VrRuntimeService.instance;
    }

    private getEnvironmentValue(name: string, environment: NodeJS.ProcessEnv = this.environment): string | undefined {
        const environmentKey = Object.keys(environment)
            .find(key => key.toLowerCase() === name.toLowerCase());
        return environmentKey ? environment[environmentKey] : undefined;
    }

    private getEffectiveEnvironmentValue(name: string, overrides: NodeJS.ProcessEnv): string | undefined {
        return this.getEnvironmentValue(name, overrides) ?? this.getEnvironmentValue(name);
    }

    private expandEnvironmentVariables(runtimePath: string, environmentOverrides: NodeJS.ProcessEnv): string {
        return runtimePath.replace(/%([^%]+)%/g, (match, variableName: string) => (
            this.getEffectiveEnvironmentValue(variableName, environmentOverrides) ?? match
        ));
    }

    private detectRuntime(runtimePath: string, environmentOverrides: NodeJS.ProcessEnv): VrRuntime {
        const expandedRuntimePath = this.expandEnvironmentVariables(runtimePath, environmentOverrides);
        try {
            if (!this.pathExists(expandedRuntimePath)) {
                return VrRuntime.NOT_SET;
            }
            return parseOpenXrRuntimePath(expandedRuntimePath);
        } catch (error) {
            log.warn("Unable to validate the active OpenXR runtime", error);
            return VrRuntime.UNKNOWN;
        }
    }

    public async getActiveRuntime(environmentOverrides: NodeJS.ProcessEnv = {}): Promise<VrRuntime> {
        const runtimeOverride = this.getEffectiveEnvironmentValue("XR_RUNTIME_JSON", environmentOverrides);
        if (runtimeOverride) {
            return this.detectRuntime(runtimeOverride, environmentOverrides);
        }

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

        return this.detectRuntime(activeRuntimePath, environmentOverrides);
    }
}
