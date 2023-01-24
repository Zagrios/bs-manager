import { NotificationResult, NotificationType, Notification } from "renderer/services/notification.service"
import { motion, PanInfo } from "framer-motion"
import { BsmImage } from "../shared/bsm-image.component";
import BeatRunningImg from "../../../../assets/images/apngs/beat-running.png";
import BeatConflictImg from "../../../../assets/images/apngs/beat-conflict.png";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png";
import BeatImpatientImg from "../../../../assets/images/apngs/beat-impatient.png";
import { BsmButton } from "../shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ForwardedRef, forwardRef } from "react";

export const NotificationItem = forwardRef(({resolver, notification}: {resolver?: (value: NotificationResult|string) => void, notification: Notification}, fwdRef: ForwardedRef<HTMLLIElement>) => {

    const t = useTranslation();

    const renderImage = (() => {
        if(notification.type === NotificationType.SUCCESS){ return BeatRunningImg; }
        if(notification.type === NotificationType.WARNING){ return BeatWaitingImg; }
        if(notification.type === NotificationType.ERROR){ return BeatConflictImg; }
        return BeatImpatientImg;
    })();

    const renderNeonColors = (() => {
        if(notification.type === NotificationType.SUCCESS){ return "bg-green-400 shadow-green-400"; }
        if(notification.type === NotificationType.WARNING){ return "bg-yellow-400 shadow-yellow-400"; }
        if(notification.type === NotificationType.ERROR){ return "bg-red-500 shadow-red-500"; }
        return "bg-gray-800 shadow-gray-800 dark:bg-white dark:shadow-white";
    })();


    const handleDragEnd = (e: MouseEvent, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if(offset > 30 && velocity > 300){
            resolver(NotificationResult.CLOSE);
        }
    }

  return (
   <motion.li ref={fwdRef} drag="x" dragConstraints={{left: 0, right: 0}} dragElastic={{left: 0, right: .3}} onDragEnd={handleDragEnd} animate={{x: "-125%"}} exit={{x: 50}} className="relative w-[290px] left-14 rounded-md overflow-hidden mb-4 cursor-grab active:cursor-grabbing shadow-md shadow-black bg-gradient-to-br from-light-main-color-2 to-light-main-color-2 dark:from-main-color-2 dark:to-main-color-2 text-gray-800 dark:text-white">
      <div className="w-full flex flex-col">
         <div className="flex items-center justify-start pl-1">
            <BsmImage className="h-14 mr-1 pointer-events-none" image={renderImage}/>
            <div className="flex flex-col py-2">
               <h1 className="font-bold leading-4 tracking-wide pr-5 my-1">{t(notification.title)}</h1>
               {notification.desc && <p className="text-xs pr-1">{t(notification.desc)}</p>}
            </div>
         </div>
         {notification.actions && (
            <div className="flex pb-1 w-full flex-wrap px-[2px]">
               {notification.actions.map(a => <span key={a.id} onClick={() => resolver(a.id)} className={`px-1 cursor-pointer flex-1 grow rounded-md text-center bg-blue-500 hover:brightness-110 transition-all text-gray-200 whitespace-nowrap m-[3px] ${a.cancel && "!bg-gray-500"}`}>{t(a.title)}</span>)}
            </div>
         )}
      </div>
      <span className={`absolute w-full h-1 shadow-center left-0 top-0 ${renderNeonColors}`}/>
      <BsmButton icon="cross" className="absolute top-2 right-2" withBar={false} onClick={() => resolver(NotificationResult.CLOSE)}/>
   </motion.li>
  )
})
