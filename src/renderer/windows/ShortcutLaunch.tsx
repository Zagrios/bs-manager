import TitleBar from "renderer/components/title-bar/title-bar.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useEffect, useState } from "react"
import { WindowManagerService } from "renderer/services/window-manager.service";
import { IpcService } from "renderer/services/ipc.service";
import { take } from "rxjs";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import defaultImage from "../../../assets/images/default-version-img.jpg";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { BsNoteFill } from "renderer/components/svgs/icons/bs-note-fill.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { motion } from "framer-motion"
import { BSLaunchError, BSLaunchEventType } from "shared/models/bs-launch";
import { NotificationService } from "renderer/services/notification.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useWindowControls } from "renderer/hooks/use-window-controls.hook";

export default function ShortcutLaunch() {

    const windows = useService(WindowManagerService);
    const ipc = useService(IpcService);
    const bsLauncher = useService(BSLauncherService);
    const notification = useService(NotificationService);

    const { close: closeWindow } = useWindowControls();
    const t = useTranslation();
    const color = useThemeColor("second-color");
    const launchOptions = useObservable(() => ipc.sendV2("shortcut-launch-options").pipe(take(1)), null)
    const [rotation, setRotation] = useState(0);
    const [status, setStatus] = useState<BSLaunchEventType>();

    useEffect(() => {
        const interval = setInterval(() => {
            setRotation(rotation => rotation + 45 * 3);
        }, 1500);

        return () => {
            clearInterval(interval);
        }
    }, []);

    useOnUpdate(() => {
        if(!launchOptions) { return; }

        const sub = bsLauncher.doLaunch(launchOptions).subscribe({
            next: event => {
                setStatus(event.type);
            },
            error: err => {
                if(!Object.values(BSLaunchError).includes(err.type)){
                    notification.notifySystem({title: t("notifications.bs-launch.errors.titles.UNKNOWN_ERROR"), body: t("notifications.bs-launch.errors.msg.UNKNOWN_ERROR")});
                } else {
                    notification.notifySystem({title: t(`notifications.bs-launch.errors.titles.${err.type}`), body: t(`notifications.bs-launch.errors.msg.${err.type}`)})
                }
            }
        });

        sub.add(() => {
            closeWindow();
        });

        return () => sub.unsubscribe();
    }, [launchOptions]);

    return (
        <div className="relative w-screen h-screen overflow-hidden ">
            <BsmImage className="absolute top-0 left-0 w-full h-full object-cover" placeholder={defaultImage} image={launchOptions?.version?.ReleaseImg ?? defaultImage}/>
            <div className="w-full h-full backdrop-blur-lg flex flex-col">
                <TitleBar template="shortcut-launch.html"/>
                <div className="grow px-6 pb-6 pt-3 flex gap-6">
                    <div className="h-full w-40 relative flex items-center justify-center">
                        <BsmImage className="absolute top-0 left-0 w-full h-full object-cover shadow-black shadow-center" placeholder={defaultImage} image={launchOptions?.version?.ReleaseImg ?? defaultImage}/>
                        <motion.div className="shadow-black shadow-[0px_0px_11px_5px] rounded-2xl aspect-square w-20 z-[1]" animate={{
                            rotate: rotation,
                            transition: {
                                type: "spring",
                            }
                        }}>
                            <BsNoteFill className="w-full h-full" style={{color: launchOptions?.version?.color ?? color}}/>
                        </motion.div>
                    </div>
                    <div className="grow flex flex-col py-3">
                        <div className="w-full h-full bg-main-color-2 rounded-md shadow-black shadow-md p-3 flex flex-col gap-3">
                            <h1 className="text-neutral-300 tracking-wide italic">{t("bs-shortcut-launch.beat-saber-launching")}</h1>
                            <h2 className="text-light-main-color-2 font-bold text-3xl">{[launchOptions?.version?.BSVersion, launchOptions?.version?.name].join(" ")}</h2>
                            <div className="flex flex-col grow justify-center text-neutral-400">
                                <span className="uppercase text-neutral-300 tracking-wide">{t("bs-shortcut-launch.launching")}</span>
                                <span className="italic text-neutral-400 leading-4 text-sm font-bold">{(
                                    status ? t(`bs-shortcut-launch.status-text.success.${status}`) : t("bs-shortcut-launch.status-text.init")
                                )}
                                </span>
                            </div>
                            <BsmButton className="shrink-0 h-10 rounded-md flex items-center justify-center" text="bs-shortcut-launch.open-bsmanager" typeColor="cancel" withBar={false} onClick={() => windows.openWindowOrFocus("index.html")}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
