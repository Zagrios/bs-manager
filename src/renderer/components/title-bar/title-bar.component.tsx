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
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import Tippy from "@tippyjs/react";
import { StaticConfigurationService } from "renderer/services/static-configuration.service";
import { AutoUpdate } from "shared/models/config";

function useVersion() {
    const ipcService = useService(IpcService);

    const [version, setVersion] = useState("");
    const [outdated, setOutdated] = useState(false);

    useEffect(() => {
        const requests: Promise<any>[] = [
            lastValueFrom(ipcService.sendV2("current-version"))
        ];
        if (window.electron.platform === "linux") {
            requests.push(lastValueFrom(ipcService.sendV2("check-update")));
        }

        Promise.all(requests).then(([ version, outdated ]) => {
            setVersion(version);
            setOutdated(outdated);
        });
    }, []);

    return { version, outdated };
}

function TitleBarTags({ version, outdated }: Readonly<{
    version: string;
    outdated: boolean;
}>) {
    const t = useTranslationV2();

    const previewVersion = (() => {
        if (version.toLowerCase().includes("alpha")) {
            return "ALPHA";
        }

        if (version.toLowerCase().includes("beta")) {
            return "BETA";
        }

        return "";
    })();

    return <>
        {previewVersion &&
            <span className="bg-main-color-1 text-white dark:text-black dark:bg-white rounded-full ml-1 text-[10px] italic px-1 uppercase h-3.5 font-bold">
                {previewVersion}
            </span>
        }
        {outdated &&
            <span className="bg-warning-500 text-black rounded-full ml-1 text-[10px] italic px-1 uppercase h-3.5 font-bold">
                {t.text("title-bar.outdated")}
            </span>
        }
    </>;
}

function AutoUpdateButton({ version, outdated }: Readonly<{
    version: string;
    outdated: boolean;
}>) {
    const configService = useService(StaticConfigurationService);
    const ipcService = useService(IpcService);

    const [ show, setShow ] = useState<boolean>(outdated);
    const { text: t } = useTranslationV2();

    const isLinux = window.electron.platform === "linux";

    async function updateAndRestart() {
        await configService.set("auto-update", AutoUpdate.ONCE);
        await lastValueFrom(ipcService.sendV2("restart-app"));
    }

    function renderTippyContent() {
        return <div className="p-2">
            <div>{t("title-bar.update-text", { version })}</div>
            {!isLinux &&
                <BsmButton typeColor="primary"
                    className="text-center font-bold rounded-md px-2 py-1 mt-2"
                    text={t("title-bar.update-button")}
                    withBar={false}
                    onClick={() => updateAndRestart()}
                />
            }
        </div>
    }

    return outdated && (
        <Tippy zIndex={1000}
            visible={show}
            content={renderTippyContent()}
            onClickOutside={() => setShow(false)}
        >
            <BsmButton
                className="shrink-0 h-[23px] w-[23px] aspect-square !bg-transparent flex items-start"
                icon="download"
                withBar={false}
                onClick={() => setShow(!show)}
            />
        </Tippy>
    );
}

export default function TitleBar({ template = "index.html" }: { template: AppWindow }) {
    const audio = useService(AudioPlayerService);
    const windowControls = useWindowControls();

    const volume = useObservable(() => audio.volume$, audio.volume);
    const color = useThemeColor("first-color");
    const { version, outdated } = useVersion();

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

    const toggleMaximize = () => {
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
                        <TitleBarTags version={version} outdated={outdated} />
                    </div>
                </div>
                <div id="window-controls" className="h-full flex shrink-0 items-center">
                    <div className="h-full text-gray-800 dark:text-gray-200 pr-1 cursor-pointer flex flex-row justify-end items-center gap-2 group pl-5">
                        <div className="shrink-0 w-0 overflow-hidden transition-all group-hover:w-16 group-hover:overflow-visible group-active:w-16 group-active:overflow-visible text-main-color-3">
                            <BsmRange min={0} max={1} step={0.01} values={[volume.muted ? 0 : volume.volume]} colors={[color, "currentColor"]} onChange={val => audio.setVolume(val[0])} onFinalChange={val => audio.setVolume(val[0])} />
                        </div>
                        <BsmButton className="shrink-0 h-[23px] w-[23px] aspect-square !bg-transparent flex items-start" iconClassName={volumeIcon === "volume-down" ? "-translate-x-[1.8px]" : null} icon={volumeIcon} withBar={false} onClick={() => audio.toggleMute()} />
                    </div>
                    <AutoUpdateButton version={version} outdated={outdated} />
                    <button onClick={minimizeWindow} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="min-button">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            <rect fill="currentColor" width="10" height="1" x="1" y="6" />
                        </svg>
                    </button>
                    <button onClick={toggleMaximize} className="text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-[#4F545C] cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="max-button">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            {maximized ? (
                                <>
                                    <rect width="9" height="9" x="0.5" y="2.5" fill="none" stroke="currentColor" />
                                    <path d="M 2.5 2.5 V 0.5 H 11.5 V 9.5 H 9.5" fill="none" stroke="currentColor" />
                                </>
                            ) : (
                                <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor" />
                            )}
                        </svg>
                    </button>
                    <button onClick={closeWindow} className="text-gray-800 dark:text-gray-200 cursor-pointer w-11 h-full shrink-0 flex justify-center items-center" id="close-button" draggable="false">
                        <svg aria-hidden="false" width="12" height="12" viewBox="0 0 12 12">
                            <polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1" />
                        </svg>
                    </button>
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
                        <polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1" />
                    </svg>
                </div>
            </div>
        </header>
    );
}
