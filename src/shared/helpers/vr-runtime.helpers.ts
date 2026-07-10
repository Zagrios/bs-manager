import { VrRuntime } from "shared/models/vr-runtime.model";

export function parseOpenXrRuntimePath(activeRuntimePath?: string): VrRuntime {
    if (!activeRuntimePath) {
        return VrRuntime.NOT_SET;
    }

    const normalizedPath = activeRuntimePath.toLowerCase().replace(/\//g, "\\");

    if (normalizedPath.includes("\\steamvr\\") || normalizedPath.includes("\\steamxr_")) {
        return VrRuntime.STEAM;
    }

    if (
        normalizedPath.includes("\\virtualdesktop\\") ||
        normalizedPath.includes("\\virtualdesktop-") ||
        normalizedPath.includes("\\virtual desktop\\") ||
        normalizedPath.includes("\\vdxr")
    ) {
        return VrRuntime.VDXR;
    }

    if (
        normalizedPath.includes("\\oculus\\") ||
        normalizedPath.includes("\\oculus-runtime\\") ||
        normalizedPath.includes("\\oculus_openxr_") ||
        normalizedPath.includes("\\meta\\quest link\\") ||
        normalizedPath.includes("\\meta_openxr_")
    ) {
        return VrRuntime.OCULUS;
    }

    return VrRuntime.OTHER;
}
