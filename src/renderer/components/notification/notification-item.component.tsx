import { NotificationResult, NotificationType, Notification } from "renderer/services/notification.service"
import { motion } from "framer-motion"
import { BsmImage } from "../shared/bsm-image.component";
import BeatRunningImg from "../../../../assets/images/apngs/beat-running.png";
import BeatConflictImg from "../../../../assets/images/apngs/beat-conflict.png";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png";
import BeatImpatientImg from "../../../../assets/images/apngs/beat-impatient.png";
import { BsmButton } from "../shared/bsm-button.component";

export function NotificationItem({resolver, index, notification}: {resolver?: (value: NotificationResult|string) => void, index: number, notification: Notification}) {

  const renderImage = () => {
    if(notification.type === NotificationType.SUCCESS){ return <BsmImage className="h-14" image={BeatRunningImg}/>; }
    if(notification.type === NotificationType.WARNING){ return <BsmImage className="h-14" image={BeatWaitingImg}/>; }
    if(notification.type === NotificationType.ERROR){ return <BsmImage className="h-14" image={BeatConflictImg}/>; }
    return <BsmImage className="h-14" image={BeatImpatientImg}/>
  }

  const renderNeonColors = () => {
    if(notification.type === NotificationType.SUCCESS){ return "bg-green-400 shadow-green-400"; }
    if(notification.type === NotificationType.WARNING){ return "bg-yellow-400 shadow-yellow-400"; }
    if(notification.type === NotificationType.ERROR){ return "bg-red-500 shadow-red-500"; }
    return "bg-gray-800 shadow-gray-800 dark:bg-white dark:shadow-white";
  }

  return (
    <motion.div layout initial={{x: "110%"}} animate={{x: "0%"}} exit={{x:"110%"}} className="relative w-60 rounded-md overflow-hidden -left-64 mb-4 shadow-md shadow-black bg-gradient-to-br from-light-main-color-3 to-light-main-color-2 dark:from-main-color-3 dark:to-main-color-2 text-gray-800 dark:text-white">
        <div className="w-60 flex flex-col">
            <div className="flex items-center justify-start pl-1">
              {renderImage()}
              <div className="flex flex-col py-2">
                <h1 className="font-bold leading-5 tracking-wide pr-5">{notification.title}</h1>
                {notification.desc && <p className="text-sm leading-4">{notification.desc}</p>}
              </div>
            </div>
            {notification.actions && (
              <div className="flex pb-1 w-full flex-wrap px-[2px]">
                {notification.actions.map(a => <span className={`px-1 flex-1 grow rounded-md text-center bg-blue-500 hover:brightness-110 transition-all text-gray-200 whitespace-nowrap m-[3px] ${a.cancel && "!bg-gray-500"}`}>{a.title}</span>)}
              </div>
            )}
        </div>
        <span className={`absolute w-full h-1 shadow-center left-0 top-0 ${renderNeonColors()}`}/>
        <BsmButton icon="cross" className="absolute top-2 right-2" withBar={false}/>
    </motion.div>
  )
}
