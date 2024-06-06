import { Observable } from "rxjs";
import { IpcService } from "../ipc.service";
import { BSVersionString } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods";

export class BeatModsService {

    private static instance: BeatModsService;

    public static getInstance(): BeatModsService {
        if (!BeatModsService.instance) {
            BeatModsService.instance = new BeatModsService();
        }
        return BeatModsService.instance;
    }

    private readonly ipcService: IpcService;

    private constructor() {
        this.ipcService = IpcService.getInstance();
    }

    public getVersionAliases(): Observable<Record<BSVersionString, BSVersionString[]>> {
        return this.ipcService.sendV2("get-version-aliases");
    }

    public getVersionMods(version: BSVersionString): Observable<Mod[]> {
        return this.ipcService.sendV2("get-version-mods", version);
    }


}
