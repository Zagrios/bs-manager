import { app } from "electron";
import path from "path";
import { URL } from "url";
import log from "electron-log"

export class DeepLinkService {

    // See docs : https://www.electronjs.org/docs/latest/tutorial/launch-app-from-url-in-another-app#main-process-mainjs

    private static instance: DeepLinkService;

    public static getInstance(): DeepLinkService{
        if(!DeepLinkService.instance){ DeepLinkService.instance = new DeepLinkService(); }
        return DeepLinkService.instance;
    }

    private readonly listeners = new Map<string, Listerner[]>()

    private constructor(){}

    public registerDeepLink(protocol: string): boolean{

        if(process.defaultApp && process.argv.length >= 2){
            return app.setAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
        }

        return app.setAsDefaultProtocolClient(protocol);
    } 

    public unRegisterDeepLink(protocol: string): boolean{

        if(process.defaultApp && process.argv.length >= 2) {
            return app.removeAsDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
        }

        return app.removeAsDefaultProtocolClient(protocol);
    }

    public isDeepLinkRegistred(protocol: string): boolean{

        if(process.defaultApp && process.argv.length >= 2) {
            return app.isDefaultProtocolClient(protocol, process.execPath, [path.resolve(process.argv[1])]);
        }

        return app.isDefaultProtocolClient(protocol);
    }

    public addLinkOpenedListener(protocol: string, fn: Listerner){
        
        if(!this.listeners.has(protocol)){
            this.listeners.set(protocol, [] as Listerner[]);
        }
        
        this.listeners.get(protocol).push(fn);
    }

    public removeLinkOpenedListener(protocol: string, fn: Listerner){
        
        if(!this.listeners.get(protocol)?.length){ return; }

        const listeners = this.listeners.get(protocol);
        const fnIndex = listeners.findIndex(listener => listener === fn);

        if(fnIndex < 0){ return; }

        listeners.splice(fnIndex, 1);

    }

    public dispatchLinkOpened(link: string){

        log.info("DEISPATCH", link);

        const url = new URL(link);

        const protocolListeners = this.listeners.get(url.protocol.replace(":", "")) ?? [];

        protocolListeners.forEach(listerner => {
            listerner(link);
        });

    }

    public isDeepLink(link: string): boolean{

        try{
            const url = new URL(link);
            const protocol = url.protocol.replace(":", "");
            return Array.from(this.listeners.keys()).some(key => key === protocol);
        }
        catch(e){
            return false;
        }

    }

}

type Listerner = (link: string) => void;