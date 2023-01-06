import { useObservable } from "renderer/hooks/use-observable.hook"
import { NotificationService } from "renderer/services/notification.service"
import { NotificationItem } from "./notification-item.component";
import { AnimatePresence } from "framer-motion";

export function NotificationOverlay() {

    const notificationService = NotificationService.getInstance();

    const notifications = useObservable(notificationService.notifications$);


  return (
    <ul className="absolute h-full w-0 top-0 right-0 z-[100] pt-10">
        <AnimatePresence mode="popLayout">
            {notifications?.map(n => <NotificationItem key={n.id} resolver={n.resolver} notification={n.notification}/>)}
        </AnimatePresence>
    </ul>
  )
}
