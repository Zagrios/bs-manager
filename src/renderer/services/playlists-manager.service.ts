import { lastValueFrom } from "rxjs";
import { IpcService } from "./ipc.service";

export class PlaylistsManagerService {
    private static instance: PlaylistsManagerService;

    public static getInstance(): PlaylistsManagerService {
        if (!PlaylistsManagerService.instance) {
            PlaylistsManagerService.instance = new PlaylistsManagerService();
        }
        return PlaylistsManagerService.instance;
    }

    private readonly ipc: IpcService;

    private constructor() {
        this.ipc = IpcService.getInstance();
    }

    public isDeepLinksEnabled(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("is-playlists-deep-links-enabled"));
    }

    public async enableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("register-playlists-deep-link"));
    }

    public async disableDeepLink(): Promise<boolean> {
        return lastValueFrom(this.ipc.sendV2("unregister-playlists-deep-link"));
    }
}
