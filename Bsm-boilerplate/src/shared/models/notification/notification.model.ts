export interface Notification {
    title: string;
    type?: NotificationType;
    desc?: string;
    actions?: NotificationAction[];
    duration?: number;
}

export enum NotificationType {
    SUCCESS = 0,
    WARNING = 1,
    ERROR = 2,
    INFO = 3,
}

export interface NotificationAction {
    id: string;
    title: string;
    cancel?: boolean;
}

export enum NotificationResult {
    NO_CHOICE = "no_choice",
    CLOSE = "close",
}
