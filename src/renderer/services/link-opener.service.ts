import { IframeModal } from "renderer/components/modal/modal-types/iframe-modal.component";
import { IpcService } from "./ipc.service";
import { ModalService } from "./modale.service";

export class LinkOpenerService{

    private static instance: LinkOpenerService;

    private readonly ipcService: IpcService;
    private readonly modals: ModalService;

    public static getInstance(): LinkOpenerService{
        if(!LinkOpenerService.instance){ LinkOpenerService.instance = new LinkOpenerService(); }
        return LinkOpenerService.instance;
    }

    private constructor(){
        this.ipcService = IpcService.getInstance();
        this.modals = ModalService.getInsance();
    }

    public open(url: string, internal?: boolean): void{
        if(internal){
            this.modals.openModal(IframeModal, url);
            return;
        }
        this.ipcService.sendLazy("new-window", {args: url});
    }

}