import { DeepLinkService } from "../deep-link.service";
import log from "electron-log"
import { ipcMain } from "electron";
import { IpcRequest } from "shared/models/ipc";
import { UtilsService } from "../utils.service";
import { WindowManagerService } from "../window-manager.service";

export class LocalModelsManagerService {

    private static instance: LocalModelsManagerService;

    public static getInstance(): LocalModelsManagerService{
        if(!LocalModelsManagerService.instance){ LocalModelsManagerService.instance = new LocalModelsManagerService(); }
        return LocalModelsManagerService.instance;
    }

    private readonly DEEP_LINKS = {
        ModelSaber: "modelsaber",
    };

    private readonly deepLink: DeepLinkService;
    private readonly utils: UtilsService;
    private readonly windows: WindowManagerService;

    private constructor(){
        this.deepLink = DeepLinkService.getInstance();
        this.utils = UtilsService.getInstance();
        this.windows = WindowManagerService.getInstance();

        this.deepLink.addLinkOpenedListener(this.DEEP_LINKS.ModelSaber, (link) => {
            log.info("DEEP-LINK RECEIVED FROM", this.DEEP_LINKS.ModelSaber, link);
            const url = new URL(link);

            const type = url.host
            const id = url.pathname.replace("/", '').split("/").at(0);

            this.openOneClickDownloadModelWindow(id, type);
        });
    }

    private openOneClickDownloadModelWindow(id: string, type: string){
        
        // TODO make once
        ipcMain.on("one-click-model-info", async (event, req: IpcRequest<void>) => {
            this.utils.ipcSend(req.responceChannel, {success: true, data: {id, type}});
        });

        this.windows.openWindow("oneclick-download-model.html");

    }



}