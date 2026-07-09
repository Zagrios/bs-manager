import { parseOpenXrRuntimePath } from "shared/helpers/vr-runtime.helpers";
import { VrRuntime } from "shared/models/vr-runtime.model";

describe("parseOpenXrRuntimePath", () => {
    const testCases: Array<[string | undefined, VrRuntime]> = [
        ["C:\\Program Files (x86)\\Steam\\steamapps\\common\\SteamVR\\steamxr_win64.json", VrRuntime.STEAM],
        ["C:\\Program Files\\Oculus\\Support\\oculus-runtime\\oculus_openxr_64.json", VrRuntime.OCULUS],
        ["C:\\Program Files\\Meta\\Quest Link\\meta_openxr_64.json", VrRuntime.OCULUS],
        ["C:\\Program Files\\Virtual Desktop\\openxr.json", VrRuntime.VDXR],
        ["C:\\Program Files\\VirtualDesktop\\vdxr.json", VrRuntime.VDXR],
        ["C:\\Program Files\\Another Runtime\\openxr.json", VrRuntime.OTHER],
        [undefined, VrRuntime.NOT_SET],
    ];

    it.each(testCases)("recognizes %p as %s", (runtimePath, expectedRuntime) => {
        expect(parseOpenXrRuntimePath(runtimePath)).toBe(expectedRuntime);
    });
});
