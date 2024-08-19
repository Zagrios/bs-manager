import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { Mod } from "shared/models/mods/mod.interface";
import { ModsGrid } from "./mods-grid.component";
import { ConfigurationService } from "renderer/services/configuration.service";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../../assets/images/apngs/beat-conflict.png";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { skip, filter } from "rxjs/operators";
import { Subscription, lastValueFrom, noop } from "rxjs";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { useInView } from "framer-motion";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { ModsDisclaimerModal } from "renderer/components/modal/modal-types/mods-disclaimer-modal.component";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { lt } from "semver";
import { useService } from "renderer/hooks/use-service.hook";
import { NotificationService } from "renderer/services/notification.service";

export function ModsSlide({ version, onDisclamerDecline }: { version: BSVersion; onDisclamerDecline: () => void }) {
    const ACCEPTED_DISCLAIMER_KEY = "accepted-mods-disclaimer";

    const modsManager = useService(BsModsManagerService);
    const configService = useService(ConfigurationService);
    const notification = useService(NotificationService);
    const linkOpener = useService(LinkOpenerService);
    const modals = useService(ModalService);
    const os = useService(OsDiagnosticService);

    const ref = useRef(null);
    const isVisible = useInView(ref, { amount: 0.5 });
    const [modsAvailable, setModsAvailable] = useState(null as Map<string, Mod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<string, Mod[]>);
    const [modsSelected, setModsSelected] = useState([] as Mod[]);
    const [moreInfoMod, setMoreInfoMod] = useState(null as Mod);
    const [reinstallAllMods, setReinstallAllMods] = useState(false);
    const isOnline = useObservable(() => os.isOnline$);
    const installing = useObservable(() => modsManager.isInstalling$);

    const downloadRef = useRef(null);
    const [downloadWith, setDownloadWidth] = useState(0);

    const modsToCategoryMap = (mods: Mod[]): Map<string, Mod[]> => {
        if (!mods) {
            return new Map<string, Mod[]>();
        }
        const map = new Map<string, Mod[]>();
        mods.forEach(mod => map.set(mod.category, [...(map.get(mod.category) ?? []), mod]));
        return map;
    };

    const handleModChange = (selected: boolean, mod: Mod) => {

        if (selected) {
            return setModsSelected(mods => {
                if (mods.some(m => m.name === mod.name)) {
                    return mods;
                }
                return [...mods, mod];
            });
        }

        setModsSelected(mods => mods.filter(m => m.name !== mod.name));
    };

    const handleMoreInfo = (mod: Mod) => {
        if (mod.name === moreInfoMod?.name) {
            return setMoreInfoMod(null);
        }
        setMoreInfoMod(mod);
    };

    const handleOpenMoreInfo = () => {
        if (!moreInfoMod?.link) {
            return;
        }
        linkOpener.open(moreInfoMod.link);
    };

    const installMods = (reinstallAll: boolean): void => {

        setReinstallAllMods(() => false);

        if (installing) {
            return;
        }

        const modsToInstall = modsSelected.filter(mod => {
            const installedMod = modsInstalled.get(mod.category)?.find(installedMod => installedMod.name === mod.name);

            if(reinstallAll || !installedMod){ return true; }

            return lt(installedMod.version, mod.version);
        });

        if (!modsToInstall.length) {
            notification.notifyInfo({ title: "pages.version-viewer.mods.notifications.all-mods-already-installed.title", desc: "pages.version-viewer.mods.notifications.all-mods-already-installed.description" });
            loadMods();
            return;
        }

        modsManager.installMods(modsToInstall, version).then(() => {
            loadMods();
        });
    };

    const loadMods = (): Promise<void> => {
        if (os.isOffline) {
            return Promise.resolve();
        }

        const promise = async () => {
            const available = await lastValueFrom(modsManager.getAvailableMods(version));
            const installed = await lastValueFrom(modsManager.getInstalledMods(version));
            return [available, installed];
        }

        return promise().then(([available, installed]) => {
            const defaultMods = installed?.length ? [] : configService.get<string[]>("default_mods" as DefaultConfigKey);
            setModsAvailable(() => modsToCategoryMap(available));
            setModsSelected(() => available.filter(m => m.required || defaultMods.some(d => m.name?.toLowerCase() === d?.toLowerCase()) || installed.some(i => m.name === i.name)));
            setModsInstalled(() => modsToCategoryMap(installed));
        });
    };

    useEffect(() => {
        const subs: Subscription[] = [];

        if(!isVisible || !isOnline){
            return noop();
        }

        (async () => {
                if (configService.get<boolean>(ACCEPTED_DISCLAIMER_KEY)) {
                    return true;
                }

                const res = await modals.openModal(ModsDisclaimerModal);
                const haveAccepted = res.exitCode === ModalExitCode.COMPLETED;

                if (haveAccepted) {
                    configService.set(ACCEPTED_DISCLAIMER_KEY, true);
                }

                return haveAccepted;
        })().then(canLoad => {
            if (!canLoad) {
                return onDisclamerDecline?.();
            }

            loadMods();

            subs.push(
                modsManager.isUninstalling$.pipe(
                    skip(1),
                    filter(uninstalling => !uninstalling)
                ).subscribe(() => {
                    loadMods();
                })
            );
        });

        return () => {
            setMoreInfoMod(null);
            setModsAvailable(null);
            setModsInstalled(null);
            subs.forEach(s => s.unsubscribe());
        };
    }, [isVisible, isOnline, version]);

    useLayoutEffect(() => {
        if (modsAvailable) {
            setDownloadWidth(downloadRef?.current?.offsetWidth);
        }
    }, [modsAvailable]);

    const renderContent = () => {
        if (!isOnline) {
            return <ModStatus text="pages.version-viewer.mods.no-internet" image={BeatConflictImg} />;
        }
        if (!modsAvailable) {
            return <ModStatus text="pages.version-viewer.mods.loading-mods" image={BeatWaitingImg} spin />;
        }
        if (!modsAvailable.size) {
            return (
                <ModStatus text="pages.version-viewer.mods.mods-not-available" image={BeatConflictImg}>
                    <span className="text-xl tracking-wide font-bold font-mono mt-1">({version.BSVersion})</span>
                </ModStatus>
            );
        }
        return (
            <>
                <div className="grow overflow-y-scroll w-full min-h-0 scrollbar-default p-0 m-0">
                    <ModsGrid modsMap={modsAvailable} installed={modsInstalled} modsSelected={modsSelected} onModChange={handleModChange} moreInfoMod={moreInfoMod} onWantInfos={handleMoreInfo} />
                </div>
                <div className="shrink-0 flex items-center justify-between px-3 py-2">
                    <BsmButton className="flex items-center justify-center rounded-md px-1 h-8" text="pages.version-viewer.mods.buttons.more-infos" typeColor="cancel" withBar={false} disabled={!moreInfoMod} onClick={handleOpenMoreInfo} style={{ width: downloadWith }}/>
                    <div ref={downloadRef} className="flex h-8 justify-center items-center gap-px overflow-hidden rounded-md">
                        <div className="grow h-full relative">
                            <BsmButton className="relative left-0 flex items-center justify-center px-2 size-full transition-[top] duration-200 ease-in-out" text="pages.version-viewer.mods.buttons.install-or-update" typeColor="primary" withBar={false} onClick={() => installMods(false)} style={{ top: reinstallAllMods ? "-100%" : "0" }} />
                            <BsmButton className="relative left-0 flex items-center justify-center px-2 size-full transition-[top] duration-200 ease-in-out " text="pages.version-viewer.mods.buttons.reinstall-all" typeColor="primary" withBar={false} onClick={() => installMods(true)} style={{ top: reinstallAllMods ? "-100%" : "0" }}/>
                        </div>
                        <BsmButton className="flex items-center justify-center shrink-0 h-full" iconClassName="transition-transform size-full ease-in-out duration-200" iconStyle={{ transform: reinstallAllMods ? "rotate(360deg)" : "rotate(180deg)" }} icon="chevron-top" typeColor="primary" withBar={false} onClick={() => setReinstallAllMods(prev => !prev)}/>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div ref={ref} className="shrink-0 w-full h-full px-8 pb-7 flex justify-center">
            <div className="relative flex flex-col grow-0 bg-light-main-color-2 dark:bg-main-color-2 size-full rounded-md shadow-black shadow-center overflow-hidden">{renderContent()}</div>
        </div>
    );
}

function ModStatus({ text, image, spin = false, children }: { text: string; image: string; spin?: boolean, children?: ReactNode}) {
    const t = useTranslation();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-200">
            <img className={`w-32 h-32 ${spin ? "spin-loading" : ""}`} src={image} alt=" " />
            <span className="text-xl mt-3 italic">{t(text)}</span>
            {children}
        </div>
    );
}
