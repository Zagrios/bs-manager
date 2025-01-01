import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { BbmCategories, BbmFullMod } from "shared/models/mods/mod.interface";
import { ModsGrid } from "./mods-grid.component";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../../assets/images/apngs/beat-conflict.png";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { skip, filter } from "rxjs/operators";
import { Subscription, lastValueFrom } from "rxjs";
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
    const [modsAvailable, setModsAvailable] = useState(null as Map<BbmCategories, BbmFullMod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<BbmCategories, BbmFullMod[]>);
    const [modsSelected, setModsSelected] = useState([] as BbmFullMod[]);
    const [moreInfoMod, setMoreInfoMod] = useState(null as BbmFullMod);
    const isOnline = useObservable(() => os.isOnline$);
    const installing = useObservable(() => modsManager.isInstalling$);

    const downloadRef = useRef(null);
    const [downloadWith, setDownloadWidth] = useState(0);

    const modsToCategoryMap = (mods: BbmFullMod[]): Map<BbmCategories, BbmFullMod[]> => {
        if (!mods) {
            return new Map<BbmCategories, BbmFullMod[]>();
        }
        const map = new Map<BbmCategories, BbmFullMod[]>();
        mods.forEach(mod => map.set(mod.mod.category, [...(map.get(mod.mod.category) ?? []), mod]));
        return map;
    };

    const handleModChange = (selected: boolean, mod: BbmFullMod) => {
        if (selected) {
            return setModsSelected([...modsSelected, mod]);
        }
        const mods = [...modsSelected];
        mods.splice(mods.findIndex(m => m.mod.id === mod.mod.id), 1);
        setModsSelected(mods);
    };

    const handleMoreInfo = (mod: BbmFullMod) => {
        if (mod.mod.id === moreInfoMod?.mod.id) {
            return setMoreInfoMod(null);
        }
        setMoreInfoMod(mod);
    };

    const handleOpenMoreInfo = () => {
        if (!moreInfoMod?.mod?.gitUrl) {
            return;
        }
        linkOpener.open(moreInfoMod.mod.gitUrl);
    };

    const installMods = () => {
        if (installing) {
            return;
        }
        const modsToInstall = modsSelected.filter(mod => {
            const corespondingMod = modsAvailable.get(mod.mod.category).find(availabeMod => availabeMod.mod.id === mod.mod.id);
            const installedMod = modsInstalled.get(mod.mod.category)?.find(installedMod => installedMod.mod.id === mod.mod.id);

            if (corespondingMod?.version && lt(corespondingMod.version.modVersion, mod.version.modVersion)) {
                return false;
            }

            if(installedMod?.version && lt(mod.version.modVersion, installedMod?.version.modVersion)){
                return false;
            }

            return true;
        });

        modsManager.installMods(modsToInstall, version).then(() => {
            loadMods();
        });
    };

    const loadMods = () => {
        if (os.isOffline) {
            return;
        }

        Promise.all([
            lastValueFrom(modsManager.getAvailableMods(version)),
            lastValueFrom(modsManager.getInstalledMods(version))
        ]).then(([available, installed]) => {
            const defaultMods = installed?.length ? [] : available.filter(m => m.mod.category === BbmCategories.Core || m.mod.category === BbmCategories.Essential);
            setModsAvailable(modsToCategoryMap(available));
            const installedMods: BbmFullMod[] = installed.map(version => {
                const mod = available.find(m => m.mod.id === version.modId);
                return mod ? { ...mod, version } : null;
            });
            setModsSelected(available.filter(m => m.mod.category === BbmCategories.Core || defaultMods.some(d => m.mod.name.toLowerCase() === d.mod.name.toLowerCase()) || installedMods.some(i => m.mod.id === i.mod.id)));
            setModsInstalled(modsToCategoryMap(installedMods));
        });
    };

    const unselectAllMods = () => {
        setModsSelected(() => []);
    };

    useEffect(() => {
        const subs: Subscription[] = [];

        if (isVisible && isOnline) {

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
                    modsManager.isUninstalling$
                        .pipe(
                            skip(1),
                            filter(uninstalling => !uninstalling)
                        )
                        .subscribe(() => {
                            loadMods();
                        })
                );
            });
        }

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
            return <ModStatus text="pages.version-viewer.mods.mods-not-available" image={BeatConflictImg} />;
        }
        return (
            <>
                <div className="grow overflow-scroll w-full min-h-0 scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-thumb-rounded-full">
                    <ModsGrid modsMap={modsAvailable} installed={modsInstalled} modsSelected={modsSelected} onModChange={handleModChange} moreInfoMod={moreInfoMod} onWantInfos={handleMoreInfo} unselectAllMods={unselectAllMods} />
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

function ModStatus({ text, image, spin = false }: { text: string; image: string; spin?: boolean }) {
    const t = useTranslation();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-200">
            <img className={`w-32 h-32 ${spin ? "spin-loading" : ""}`} src={image} alt=" " />
            <span className="text-xl mt-3 h-0 italic">{t(text)}</span>
        </div>
    );
}
