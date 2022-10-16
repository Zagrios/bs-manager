import { IpcService } from "./ipc.service";

export class LinkOpenerService{

    private static instance: LinkOpenerService;

    private readonly ipcService: IpcService

    public static getInstance(): LinkOpenerService{
        if(!LinkOpenerService.instance){ LinkOpenerService.instance = new LinkOpenerService(); }
        return LinkOpenerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public open(url: string): void{
        this.ipcService.sendLazy("new-window", {args: url});
    }

}