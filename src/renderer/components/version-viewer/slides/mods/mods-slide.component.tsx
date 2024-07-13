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

export function ModsSlide({ version, onDisclamerDecline }: { version: BSVersion; onDisclamerDecline: () => void }) {
    const ACCEPTED_DISCLAIMER_KEY = "accepted-mods-disclaimer";

    const modsManager = useService(BsModsManagerService);
    const configService = useService(ConfigurationService);
    const linkOpener = useService(LinkOpenerService);
    const modals = useService(ModalService);
    const os = useService(OsDiagnosticService);

    const ref = useRef(null);
    const isVisible = useInView(ref, { amount: 0.5 });
    const [modsAvailable, setModsAvailable] = useState(null as Map<string, Mod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<string, Mod[]>);
    const [modsSelected, setModsSelected] = useState([] as Mod[]);
    const [moreInfoMod, setMoreInfoMod] = useState(null as Mod);
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
            return setModsSelected([...modsSelected, mod]);
        }
        const mods = [...modsSelected];
        mods.splice(
            mods.findIndex(m => m.name === mod.name),
            1
        );
        setModsSelected(mods);
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

    const installMods = () => {
        if (installing) {
            return;
        }
        const modsToInstall = modsSelected.filter(mod => {
            const corespondingMod = modsAvailable.get(mod.category).find(availabeMod => availabeMod._id === mod._id);
            const installedMod = modsInstalled.get(mod.category)?.find(installedMod => installedMod.name === mod.name);

            if (corespondingMod?.version && lt(corespondingMod.version, mod.version)) {
                return false;
            }

            if(installedMod?.version && lt(mod.version, installedMod?.version)){
                return false;
            }

            return true;
        });

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
            const defaultMods = configService.get<string[]>("default_mods" as DefaultConfigKey);
            setModsAvailable(() => modsToCategoryMap(available));
            setModsSelected(() => available.filter(m => m.required || defaultMods.some(d => m.name.toLowerCase() === d.toLowerCase()) || installed.some(i => m.name === i.name)));
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
                <div className="grow overflow-scroll w-full min-h-0 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-thumb-rounded-full">
                    <ModsGrid modsMap={modsAvailable} installed={modsInstalled} modsSelected={modsSelected} onModChange={handleModChange} moreInfoMod={moreInfoMod} onWantInfos={handleMoreInfo} />
                </div>
                <div className="h-10 shrink-0 flex items-center justify-between px-3">
                    <BsmButton className="text-center rounded-md px-2 py-[2px]" text="pages.version-viewer.mods.buttons.more-infos" typeColor="cancel" withBar={false} disabled={!moreInfoMod} onClick={handleOpenMoreInfo} style={{ width: downloadWith }} />
                    <div ref={downloadRef}>
                        <BsmButton className="text-center rounded-md px-2 py-[2px]" text="pages.version-viewer.mods.buttons.install-or-update" withBar={false} disabled={installing} typeColor="primary" onClick={installMods} />
                    </div>
                </div>
            </>
        );
    };

    return (
        <div ref={ref} className="shrink-0 w-full h-full px-8 pb-7 flex justify-center">
            <div className="relative flex flex-col grow-0 bg-light-main-color-2 dark:bg-main-color-2 h-full w-full rounded-md shadow-black shadow-center overflow-hidden">{renderContent()}</div>
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
