import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { BbmCategories, BbmFullMod, BbmModVersion } from "shared/models/mods/mod.interface";
import { ModsGrid } from "./mods-grid.component";
import { ConfigurationService } from "renderer/services/configuration.service";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../../assets/images/apngs/beat-conflict.png";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { lastValueFrom } from "rxjs";
import { useTranslation, useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { useInView } from "framer-motion";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { ModsDisclaimerModal } from "renderer/components/modal/modal-types/mods-disclaimer-modal.component";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { lt } from "semver";
import { useService } from "renderer/hooks/use-service.hook";
import { NotificationService } from "renderer/services/notification.service";
import { noop } from "shared/helpers/function.helpers";
import { UninstallAllModsModal } from "renderer/components/modal/modal-types/uninstall-all-mods-modal.component";
import { Dropzone } from "renderer/components/shared/dropzone.component";

export function ModsSlide({ version, onDisclamerDecline }: { version: BSVersion; onDisclamerDecline: () => void }) {
    const ACCEPTED_DISCLAIMER_KEY = "accepted-mods-disclaimer";

    const { text: t } = useTranslationV2();

    const modsManager = useService(BsModsManagerService);
    const configService = useService(ConfigurationService);
    const notification = useService(NotificationService);
    const linkOpener = useService(LinkOpenerService);
    const modals = useService(ModalService);
    const os = useService(OsDiagnosticService);

    const ref = useRef(null);
    const isVisible = useInView(ref, { amount: 0.5 });
    const [modsAvailable, setModsAvailable] = useState(null as Map<BbmCategories, BbmFullMod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<BbmCategories, BbmFullMod[]>);
    const [modsSelected, setModsSelected] = useState([] as BbmFullMod[]);
    const [moreInfoMod, setMoreInfoMod] = useState(null as BbmFullMod);
    const [reinstallAllMods, setReinstallAllMods] = useState(false);
    const isOnline = useObservable(() => os.isOnline$);
    const [installing, setInstalling] = useState(false);
    const [uninstalling, setUninstalling] = useState(false);
    const [modsDropZoneOpen, setModsDropZoneOpen] = useState(false);

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
            return setModsSelected(mods => {
                if (mods.some(m => m.mod.id === mod.mod.id)) {
                    return mods;
                }
                return [...mods, mod];
            });
        }

        setModsSelected(mods => mods.filter(m => m.mod.id !== mod.mod.id));
    };

    const handleMoreInfo = (mod: BbmFullMod) => {
        if (mod.mod.id === moreInfoMod?.mod.id) {
            return setMoreInfoMod(null);
        }
        setMoreInfoMod(mod);
    };

    const handleOpenMoreInfo = () => {
        if (moreInfoMod?.mod?.gitUrl) {
            linkOpener.open(moreInfoMod.mod.gitUrl);
        }
    };

    const getAllDependencies = (mods: BbmFullMod[], availableMods: BbmFullMod[]): BbmFullMod[] => {
        const collectedDependencies = new Set<BbmFullMod>();
        const modIdsToProcess = new Set(mods.flatMap(m => m.version.dependencies));

        for (const currentId of modIdsToProcess) {
            const dependency = availableMods.find(m => m.version.id === currentId);
            if (dependency && !collectedDependencies.has(dependency)) {
                collectedDependencies.add(dependency);
                dependency.version.dependencies?.forEach(depId => modIdsToProcess.add(depId));
            }
        }

        return Array.from(collectedDependencies);
    };

    const installMods = (reinstallAll: boolean): void => {

        setReinstallAllMods(false);

        if (installing) {
            return;
        }

        let modsToInstall = [
            ...modsSelected,
            ...getAllDependencies(modsSelected, Array.from(modsAvailable.values()).flat())
        ];

        modsToInstall = reinstallAll ? (
            modsToInstall // If reinstalling all, we install all selected mods
        ) : (
            modsToInstall.filter(mod => { // Else we only install the mods that are not installed or have a newer version
                const installedMod = modsInstalled.get(mod.mod.category)?.find(installedMod => installedMod.mod.id === mod.mod.id);
                return !installedMod || lt(installedMod.version.modVersion, mod.version.modVersion);
            })
        );

        // Remove duplicates, null and undefined
        const set = new Set(modsToInstall);
        set.delete(null);
        set.delete(undefined);

        modsToInstall = Array.from(set); // Remove duplicates

        if (!modsToInstall.length) {
            notification.notifyInfo({ title: "pages.version-viewer.mods.notifications.all-mods-already-installed.title", desc: "pages.version-viewer.mods.notifications.all-mods-already-installed.description" });
            loadMods();
            return;
        }

        setInstalling(() => true)
        lastValueFrom(modsManager.installMods(modsToInstall, version)).then(() => {
            loadMods();
        }).catch(noop).finally(() => setInstalling(() => false));
    };

    const importMods = (files: string[]): void => {
        setModsDropZoneOpen(false);
        modsManager.importMods(files, version);
    };

    const uninstallMod = (mod: BbmFullMod): void => {
        setUninstalling(() => true);
        lastValueFrom(modsManager.uninstallMod(mod, version)).catch(noop).finally(() => {
            loadMods();
            setUninstalling(() => false);
        });
    };

    const uninstallAllMods = async () => {
        const res = await modals.openModal(UninstallAllModsModal, {data: version});

        if (res.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        setUninstalling(() => true);
        lastValueFrom(modsManager.uninstallAllMods(version)).catch(noop).finally(() => {
            loadMods();
            setUninstalling(() => false);
        })
    };

    const unselectAllMods = () => {
        setModsSelected(() => []);
    }

    const loadMods = async (): Promise<void> => {
        if (os.isOffline) {
            return Promise.resolve();
        }

        const promise = async (): Promise<[BbmFullMod[], BbmModVersion[]]> => {
            const available = await lastValueFrom(modsManager.getAvailableMods(version));
            const installed = await lastValueFrom(modsManager.getInstalledMods(version));
            return [available, installed];
        }

        return promise().then(([available, installed]) => {
            const defaultMods = installed?.length ? [] : available.filter(m => m.mod.category === BbmCategories.Core || m.mod.category === BbmCategories.Essential);
            setModsAvailable(() => modsToCategoryMap(available));

            const installedMods: BbmFullMod[] = installed.map(version => {
                const mod = available.find(m => m.mod.id === version.modId);
                return mod ? { ...mod, version } : null;
            }).filter(mod => mod);

            setModsSelected(available.filter(m => m.mod.category === BbmCategories.Core || defaultMods.some(d => m.mod.name.toLowerCase() === d.mod.name.toLowerCase()) || installedMods.some(i => m.mod.id === i.mod.id)));
            setModsInstalled(modsToCategoryMap(installedMods));
        });
    };

    useEffect(() => {

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
        });

        return () => {
            setMoreInfoMod(null);
            setModsAvailable(null);
            setModsInstalled(null);
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
                    <ModsGrid
                        modsMap={modsAvailable}
                        installed={modsInstalled}
                        modsSelected={modsSelected}
                        onModChange={handleModChange}
                        moreInfoMod={moreInfoMod}
                        onWantInfos={handleMoreInfo}
                        disabled={uninstalling || installing}
                        uninstallMod={uninstallMod}
                        uninstallAllMods={uninstallAllMods}
                        unselectAllMods={unselectAllMods}
                        openModsDropZone={() => setModsDropZoneOpen(true)}
                    />
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
            <Dropzone
                className="w-full h-full shrink-0"
                onFiles={importMods}
                text={t("pages.version-viewer.mods.drop-zone.text")}
                subtext={t("pages.version-viewer.mods.drop-zone.subtext")}
                open={modsDropZoneOpen}
                onClose={modsDropZoneOpen ? () => setModsDropZoneOpen(false) : undefined}
                filters={[
                    { name: ".zip", extensions: ["zip"] },
                    { name: ".dll", extensions: ["dll"] }
                ]}
                dialogOptions={{ dialog: {
                    properties: ["openFile", "multiSelections"],
                }}}
            >
                <div className="relative flex flex-col grow-0 bg-light-main-color-2 dark:bg-main-color-2 size-full rounded-md shadow-black shadow-center overflow-hidden">{renderContent()}</div>
            </Dropzone>
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
