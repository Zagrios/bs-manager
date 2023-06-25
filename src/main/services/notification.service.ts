import { SystemNotificationOptions } from "shared/models/notification/system-notification.model";
import { UtilsService } from "./utils.service";
import { Notification } from "electron";
import { Notification as NotificationRenderer } from "../../shared/models/notification/notification.model";
import { IpcService } from "./ipc.service";

export class NotificationService {

    private static instance: NotificationService;

    public static getInstance(): NotificationService{
        if(!NotificationService.instance){ NotificationService.instance = new NotificationService(); }
        return NotificationService.instance;
    }

    private readonly APP_ICON: string;

    private readonly utils: UtilsService;
    private readonly ipc: IpcService;

    private constructor(){
        this.utils = UtilsService.getInstance();
        this.ipc = IpcService.getInstance();
        this.APP_ICON = this.utils.getAssetsPath("favicon.ico");
    }

    public notify(options: SystemNotificationOptions){
        new Notification({...options, icon: this.APP_ICON}).show();
    }

    // TODO : Make actions work
    public notifyRenderer(notification: Omit<NotificationRenderer, "actions">){
        try{
            this.ipc.send("show-notification", "index.html", notification);
        }
        catch(e){
            console.error(e);
        }
        
    }

}