import { Notification } from "electron";
import { SystemNotificationOptions } from "shared/models/notification/system-notification.model";
import { UtilsService } from "./utils.service";

export class NotificationService {

    private static instance: NotificationService;

    public static getInstance(): NotificationService{
        if(!NotificationService.instance){ NotificationService.instance = new NotificationService(); }
        return NotificationService.instance;
    }

    private readonly APP_ICON: string;

    private readonly utils: UtilsService;

    private constructor(){
        this.utils = UtilsService.getInstance();
        this.APP_ICON = this.utils.getAssetsPath("favicon.ico");
    }

    public notify(options: SystemNotificationOptions){
        new Notification({...options, icon: this.APP_ICON}).show();
    }

}