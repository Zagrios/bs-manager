import { IpcService } from "./ipc.service";

export class ModelsManagerService {

    private static instance: ModelsManagerService;

    public static getInstance(): ModelsManagerService{
        if(!ModelsManagerService.instance){ ModelsManagerService.instance = new ModelsManagerService(); }
        return ModelsManagerService.instance;
    }

    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
    }

    public isDeepLinksEnabled(): Promise<boolean>{
        return this.ipc.send<boolean>("is-models-deep-links-enabled").then(res => (
            res.success ? res.data : false
        ));
    }

    public async enableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("register-models-deep-link");
        return res.success ? res.data : false;
    }

    public async disableDeepLink(): Promise<boolean>{
        const res = await this.ipc.send<boolean>("unregister-models-deep-link");
        return res.success ? res.data : false;
    }

}