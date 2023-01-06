import { IpcService } from "./ipc.service";

export class PlaylistsManagerService {

    private static instance: PlaylistsManagerService;

    public static getInstance(): PlaylistsManagerService{
        if(!PlaylistsManagerService.instance){ PlaylistsManagerService.instance = new PlaylistsManagerService(); }
        return PlaylistsManagerService.instance;
    }

    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
    }

    public isDeepLinksEnabled(): Promise<boolean>{
        return this.ipc.send<boolean>("is-playlists-deep-links-enabled").then(res => (
            res.success ? res.data : false
        ));
    }

    public async enableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("register-playlists-deep-link");
        return res.success ? res.data : false;
    }

    public async disableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("unregister-playlists-deep-link");
        return res.success ? res.data : false;
    }

}