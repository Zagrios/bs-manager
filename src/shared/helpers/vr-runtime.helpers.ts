import { VrRuntime } from "shared/models/vr-runtime.model";

export function parseOpenXrRuntimePath(activeRuntimePath?: string): VrRuntime {
    if (!activeRuntimePath) {
        return VrRuntime.NOT_SET;
    }

    const normalizedPath = activeRuntimePath.toLowerCase();

    if (normalizedPath.includes("steamvr")) {
        return VrRuntime.STEAM;
    }

    if (normalizedPath.includes("oculus") || normalizedPath.includes("meta")) {
        return VrRuntime.OCULUS;
    }

    if (normalizedPath.includes("virtualdesktop") || normalizedPath.includes("virtual desktop") || normalizedPath.includes("vdxr")) {
        return VrRuntime.VDXR;
    }

    return VrRuntime.OTHER;
}
