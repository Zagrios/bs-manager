import { BehaviorSubject } from "rxjs";
import { v4 as uuidv4 } from 'uuid';

export class NotificationService{

    private static instance: NotificationService;

    public readonly notifications$: BehaviorSubject<ResolvableNotification[]>;

    public static getInstance(): NotificationService{
        if(!NotificationService.instance){ NotificationService.instance = new NotificationService(); }
        return NotificationService.instance;
    }

    private constructor(){
        this.notifications$ = new BehaviorSubject<ResolvableNotification[]>([]);

        setInterval(() => {
            this.notify({title: "coucou le testaze aze azeazeaze", desc: "ceci est un test de notification ne rien faire", actions:[{id: "1",title: "Continuer"}, {id: "1",title: "Faire autre"}, {id: "1",title: "Annuler", cancel: true}]});
        }, 5000)
    }

    public notify(notification: Notification): Promise<NotificationResult|string>{
        let resovableNotification: ResolvableNotification;
        const promise = new Promise<NotificationResult|string>(resolve => {
            resovableNotification = {id: uuidv4(), notification: notification, resolver: resolve }
            setTimeout(() => resolve(NotificationResult.NO_CHOICE), notification.duration || 10000);
        });

        this.notifications$.next([...this.notifications$.value, resovableNotification]);

        promise.then(() => {
            this.notifications$.next(this.notifications$.value.filter(n => n.id !== resovableNotification.id));
        })

        return promise;
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