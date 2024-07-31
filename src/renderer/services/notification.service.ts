import { BehaviorSubject, Observable } from "rxjs";
import { SystemNotificationOptions } from "shared/models/notification/system-notification.model";
import { IpcService } from "./ipc.service";
import { NotificationResult, NotificationType, Notification } from "../../shared/models/notification/notification.model";

export class NotificationService {
    private static instance: NotificationService;

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public readonly notifications$: BehaviorSubject<ResolvableNotification[]>;

    private readonly ipc: IpcService;

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.notifications$ = new BehaviorSubject<ResolvableNotification[]>([]);
    }

    public notify(notification: Notification): Promise<NotificationResult | string> {
        const resovableNotification: ResolvableNotification = { id: crypto.randomUUID(), notification, resolver: null };
        const promise = new Promise<NotificationResult | string>(resolve => {
            resovableNotification.resolver = resolve;
            setTimeout(() => resolve(NotificationResult.NO_CHOICE), notification.duration || 7000);
        });

        this.notifications$.next([...this.notifications$.value, resovableNotification]);

        promise.then(() => {
            this.notifications$.next(this.notifications$.value.filter(n => n.id !== resovableNotification.id));
        });

        return promise;
    }

    public notifyError(notification: Notification): Promise<NotificationResult | string> {
        notification.type = NotificationType.ERROR;
        return this.notify(notification);
    }

    public notifyWarning(notification: Notification): Promise<NotificationResult | string> {
        notification.type = NotificationType.WARNING;
        return this.notify(notification);
    }

    public notifySuccess(notification: Notification): Promise<NotificationResult | string> {
        notification.type = NotificationType.SUCCESS;
        return this.notify(notification);
    }

    public notifyInfo(notification: Notification): Promise<NotificationResult | string> {
        notification.type = NotificationType.INFO;
        return this.notify(notification);
    }

    public notifySystem(options: SystemNotificationOptions): Observable<void> {
        return this.ipc.sendV2("notify-system",  options);
    }
}

interface ResolvableNotification {
    id: string;
    resolver: (value: NotificationResult | string) => void;
    notification: Notification;
}
