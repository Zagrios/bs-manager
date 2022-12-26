import { BehaviorSubject } from "rxjs";
import { SystemNotificationOptions } from "shared/models/notification/system-notification.model";
import { IpcService } from "./ipc.service";

export class NotificationService{

    private static instance: NotificationService;

    

    public static getInstance(): NotificationService{
        if(!NotificationService.instance){ NotificationService.instance = new NotificationService(); }
        return NotificationService.instance;
    }

    public readonly notifications$: BehaviorSubject<ResolvableNotification[]>;

    private readonly ipc: IpcService;

    private constructor(){
        this.ipc = IpcService.getInstance();
        this.notifications$ = new BehaviorSubject<ResolvableNotification[]>([]);
    }

    public notify(notification: Notification): Promise<NotificationResult|string>{
        const resovableNotification: ResolvableNotification = {id: crypto.randomUUID(), notification, resolver: null };
        const promise = new Promise<NotificationResult|string>(resolve => {
            resovableNotification.resolver = resolve;
            setTimeout(() => resolve(NotificationResult.NO_CHOICE), notification.duration || 7000);
        });

        this.notifications$.next([...this.notifications$.value, resovableNotification]);

        promise.then(() => {
            this.notifications$.next(this.notifications$.value.filter(n => n.id !== resovableNotification.id));
        })

        return promise;
    }

    public notifyError(notification: Notification): Promise<NotificationResult|string>{
        notification.type = NotificationType.ERROR;
        return this.notify(notification);
    }

    public notifyWarning(notification: Notification): Promise<NotificationResult|string>{
        notification.type = NotificationType.WARNING;
        return this.notify(notification);
    }

    public notifySuccess(notification: Notification): Promise<NotificationResult|string>{
        notification.type = NotificationType.SUCCESS;
        return this.notify(notification);
    }

    public notifySystem(options: SystemNotificationOptions){
        this.ipc.sendLazy<SystemNotificationOptions>("notify-system", {args: options});
    }

}

export interface Notification {
    title: string,
    type?: NotificationType
    desc?: string,
    actions?: NotificationAction[],
    duration?: number,
}

export enum NotificationType {
    SUCCESS = 0,
    WARNING = 1,
    ERROR = 2,
}

export interface NotificationAction {
    id: string,
    title: string,
    cancel?: boolean
}

export enum NotificationResult {
    NO_CHOICE = "no_choice",
    CLOSE = "close",
}

interface ResolvableNotification{
    id: string,
    resolver: (value: NotificationResult|string) => void,
    notification: Notification
}