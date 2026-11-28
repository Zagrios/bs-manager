import { Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsArm64Progress, BsArm64Status } from "shared/models/bs-arm64/bs-arm64.model";
import { IpcService } from "./ipc.service";

export class BsArm64Service {
    private static instance: BsArm64Service;

    public static getInstance(): BsArm64Service {
        if (!BsArm64Service.instance) {
            BsArm64Service.instance = new BsArm64Service();
        }
        return BsArm64Service.instance;
    }

    private readonly ipc = IpcService.getInstance();

    private constructor() {}

    public getStatus(version: BSVersion): Observable<BsArm64Status> {
        return this.ipc.sendV2("bs-arm64.get-status", version);
    }

    /** On ARM64 Linux without a valid Proton folder, selects an ARM64 Proton from the Steam libraries. */
    public autoSelectProtonFolder(): Observable<{ folder?: string; arm64: boolean }> {
        return this.ipc.sendV2("bs-arm64.auto-select-proton-folder");
    }

    /** Beat Saber versions that can run natively on this device; empty off ARM64 Linux. */
    public getNativeVersions(): Observable<string[]> {
        return this.ipc.sendV2("bs-arm64.get-native-versions");
    }

    public install(version: BSVersion): Observable<BsArm64Progress> {
        return this.ipc.sendV2("bs-arm64.install", version);
    }

    public uninstall(version: BSVersion): Observable<BsArm64Progress> {
        return this.ipc.sendV2("bs-arm64.uninstall", version);
    }
}
