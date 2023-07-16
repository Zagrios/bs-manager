import { useObservable } from "renderer/hooks/use-observable.hook";
import { NotificationService } from "renderer/services/notification.service";
import { NotificationItem } from "./notification-item.component";
import { AnimatePresence } from "framer-motion";
import { useService } from "renderer/hooks/use-service.hook";

export function NotificationOverlay() {
    const notificationService = useService(NotificationService);

    const notifications = useObservable(notificationService.notifications$);

    return (
        <ul className="absolute h-full w-0 top-0 right-0 z-[100] pt-10">
            <AnimatePresence mode="popLayout">
                {notifications?.map(n => (
                    <NotificationItem key={n.id} resolver={n.resolver} notification={n.notification} />
                ))}
            </AnimatePresence>
        </ul>
    );
}
