import { useEffect, useState } from "react";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { AudioPlayerService } from "renderer/services/audio-player.service";
import { IpcService } from "renderer/services/ipc.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { BsmButton } from "../shared/bsm-button.component";
import { BsmRange } from "../shared/bsm-range.component";
import { BsmIconType } from "../svgs/bsm-icon.component";
import "./title-bar.component.css";
import { useService } from "renderer/hooks/use-service.hook";
import { lastValueFrom } from "rxjs";
import { useWindowControls } from "renderer/hooks/use-window-controls.hook";

export default function TitleBar({ template = "index.html" }: { template: AppWindow }) {

    const ipcService = useService(IpcService);
    const audio = useService(AudioPlayerService);
    const windowControls = useWindowControls();

    const volume = useObservable(() => audio.volume$, audio.volume);
    const color = useThemeColor("first-color");

    const [previewVersion, setPreviewVersion] = useState(null);

    useEffect(() => {
        lastValueFrom(ipcService.sendV2("current-version")).then(version => {
            if (version.toLowerCase().includes("alpha")) {
                return setPreviewVersion("ALPHA");
            }
            if (version.toLowerCase().includes("beta")) {
                return setPreviewVersion("BETA");
            }
        });
    }, []);

    const [maximized, setMaximized] = useState(false);

    const closeWindow = () => {
        return windowControls.close();
    };

    const maximizeWindow = () => {
        windowControls.maximise();
    };

    const minimizeWindow = () => {
        windowControls.minimise();
    };

    const resetWindow = () => {
        windowControls.unmaximise();
    };

    const toogleMaximize = () => {
        if (maximized) {
            resetWindow();
        } else {
            maximizeWindow();
        }
        setMaximized(!maximized);
    };

    const volumeIcon: BsmIconType = (() => {
        if (volume.muted || !volume.volume) {
            return "volume-off";
        }
        if (volume.volume < 0.5) {
            return "volume-down";
        }
        return "volume-up";
    })();

    if (template === "index.html") {
        return (
            <header id="titlebar" className="min-h-[22px] w-screen h-[22px] flex content-center items-center justify-start z-10 shrink-0">
                <div id="drag-region" className="grow basis-0 h-full">
                    <div id="window-title" className="pl-1">
                        <span className="text-gray-800 dark:text-gray-100 font-bold text-xs italic">BSManager</span>
                        {previewVersion && <span className="bg-main-color-1 text-white dark:text-black dark:bg-white rounded-full ml-1 text-[10px] italic px-1 uppercase h-3.5 font-bold">{previewVersion}</span>}
                    </div>
                </div>
                <div id="window-controls" className="h-full flex shrink-0 items-center">
                    <div className="h-full text-gray-800 dark:text-gray-200 pr-1 cursor-pointer flex flex-row justify-end items-center gap-2 group pl-5">
                        <div className="shrink-0 w-0 overflow-hidden transition-all group-hover:w-16 group-hover:overflow-visible group-active:w-16 group-active:overflow-visible text-main-color-3">
                            <BsmRange min={0} max={1} step={0.01} values={[volume.muted ? 0 : volume.volume]} colors={[color, "currentColor"]} onChange={val => audio.setVolume(val[0])} onFinalChange={val => audio.setFinalVolume(val[0])} />
                        </div>
                        <BsmButton className="shrink-0 h-[23px] w-[23px] aspect-square !bg-transparent flex items-start" iconClassName={volumeIcon === "volume-down" ? "-translate-x-[1.8px]" : null} icon={volumeIcon} withBar={false} onClick={() => audio.toggleMute()} />
                    </div>
                    <div onClick={minimizeWindow} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="min-button">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            <rect fill="currentColor" width="10" height="1" x="1" y="6">
                                {" "}
                            </rect>
                        </svg>
                    </div>
                    <div onClick={toogleMaximize} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="max-button">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor">
                                {" "}
                            </rect>
                        </svg>
                    </div>
                    <div onClick={closeWindow} className="text-gray-800 dark:text-gray-200 cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="close-button" draggable="false">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            <polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1">
                                {" "}
                            </polygon>
                        </svg>
                    </div>
                </div>
            </header>
        );
    }
    if (template === "launcher.html") {
        return (
            <header id="titlebar" className="min-h-[22px] bg-transparent w-screen h-[22px] z-10">
                <div id="drag-region" className="grow basis-0 h-full" />
            </header>
        );
    }

    return (
        <header id="titlebar" className="min-h-[22px] bg-transparent w-screen h-[22px] flex content-center items-center justify-start z-10">
            <div id="drag-region" className="grow h-full">
                <div id="window-title" className="pl-1">
                    <span className="text-gray-100 font-bold text-xs italic">BSManager</span>
                </div>
            </div>
            <div id="window-controls" className="h-full flex shrink-0">
                <div onClick={closeWindow} className="text-gray-200 cursor-pointer w-7 h-full shrink-0 flex justify-center items-center rounded-bl-md" id="close-button" draggable="false">
                    <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                        <polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"/>
                    </svg>
                </div>
            </div>
        </header>
    );
}
