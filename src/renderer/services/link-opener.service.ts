import { Observable } from "rxjs";
import { Subject } from "rxjs";
import { IpcService } from "./ipc.service";

export class LinkOpenerService{

    private static instance: LinkOpenerService;

    private readonly ipcService: IpcService;
    
    private readonly _iframeLink$: Subject<string> = new Subject();

    public static getInstance(): LinkOpenerService{
        if(!LinkOpenerService.instance){ LinkOpenerService.instance = new LinkOpenerService(); }
        return LinkOpenerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public open(url: string, internal?: boolean): void{
        if(internal){
            return this._iframeLink$.next(url);
        }
        this.ipcService.sendLazy("new-window", {args: url});
    }

    public closeIframe(){
        this._iframeLink$.next(null);
    }

    public get iframeLink$(): Observable<string>{
        return this._iframeLink$.asObservable();
    }

}