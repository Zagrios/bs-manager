import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { BSVersion } from "shared/bs-version.interface";
import { ExternalMod, Mod } from "shared/models/mods/mod.interface";
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
import { IpcService } from "renderer/services/ipc.service";
import { Dropzone } from "renderer/components/shared/dropzone.component";
import { ExternalModModal, ExternalModModalType } from "renderer/components/modal/modal-types/external-mod-modal.component";


export function ModsSlide({ version, onDisclamerDecline }: { version: BSVersion; onDisclamerDecline: () => void }) {
    const ACCEPTED_DISCLAIMER_KEY = "accepted-mods-disclaimer";

    const modsManager = useService(BsModsManagerService);
    const configService = useService(ConfigurationService);
    const notification = useService(NotificationService);
    const linkOpener = useService(LinkOpenerService);
    const modals = useService(ModalService);
    const os = useService(OsDiagnosticService);
    const ipcService = useService(IpcService);

    const ref = useRef(null);
    const isVisible = useInView(ref, { amount: 0.5 });
    const [modsAvailable, setModsAvailable] = useState(null as Map<string, Mod[]>);
    const [modsInstalled, setModsInstalled] = useState(null as Map<string, Mod[]>);
    const [modsSelected, setModsSelected] = useState([] as Mod[]);
    const [modsExternal, setModsExternal] = useState({} as { [key: string]: ExternalMod; });
    const [modsExternalChanged, setModsExternalChanged] = useState([] as ExternalMod[]);
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

    const handleExternalModCheckboxToggle = (checked: boolean, mod: ExternalMod) => {
        if (modsExternal[mod.id].enabled === checked) {
            setModsExternalChanged(modsExternalChanged.filter(m => m.id !== mod.id));
        } else {
            const modCopy = { ...mod };
            modCopy.enabled = checked;
            setModsExternalChanged([ ...modsExternalChanged, modCopy ]);
        }
    };

    const handleExternalModDoubleClick = async (mod: ExternalMod) => {
        const modalResponse = await modals.openModal(ExternalModModal, { data: {
            name: mod.name,
            version: mod.version,
            description: mod.description,
            files: mod.files,
            type: ExternalModModalType.UPDATE
        }});
        if (modalResponse.exitCode === ModalExitCode.CANCELED) {
            notification.notifyError({
                title: "notifications.mods.external-mod.titles.update-error",
                desc: "notifications.mods.external-mod.msgs.update-error"
            });
            return;
        }

        if (modalResponse.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        modalResponse.data.id = mod.id;

        const updatedMod = await lastValueFrom(ipcService.sendV2("bs-mods.update-external-mod", {
            version,
            mod: modalResponse.data,
        }))
        if (!updatedMod) {
            notification.notifyError({
                title: "notifications.mods.external-mod.titles.update-error",
                desc: "notifications.mods.external-mod.titles.update-error"
            });
            return;
        }

        notification.notifySuccess({
            title: "notifications.mods.external-mod.titles.update-success",
            desc: "notifications.mods.external-mod.msgs.update-success",
            duration: 10_000
        });
        setModsExternal({ ...modsExternal, [updatedMod.id]: updatedMod });
    }

    const handleExternalModUninstall = (mod: ExternalMod) => {
        const modsCopy = { ...modsExternal };
        delete modsCopy[mod.id];
        setModsExternal(modsCopy);
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

        modsManager.installMods(modsToInstall, version).then(() => {
            loadMods();
        });
    };

    const toggleMods = async () => {
        await modsManager.toggleMods(modsExternalChanged, version);
        setModsExternalChanged([]);
        loadMods();
    }

    const loadMods = (): Promise<void> => {
        if (os.isOffline) {
            return Promise.resolve();
        }

        return Promise.all([
            lastValueFrom(modsManager.getAvailableMods(version)),
            lastValueFrom(modsManager.getInstalledMods(version)),
            lastValueFrom(modsManager.getInstalledExternalMods(version)),
        ]).then(([available, installed, installedExternal]) => {
            const defaultMods = installed?.length ? [] : configService.get<string[]>("default_mods" as DefaultConfigKey);
            setModsAvailable(() => modsToCategoryMap(available));
            setModsSelected(() => available.filter(m => m.required || defaultMods.some(d => m.name?.toLowerCase() === d?.toLowerCase()) || installed.some(i => m.name === i.name)));
            setModsInstalled(() => modsToCategoryMap(installed));
            setModsExternal(installedExternal);
        });
    };

    useEffect(() => {
        const subs: Subscription[] = [];

        setModsExternalChanged([]);

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

    const onFileDrop = async (fileList: FileList) => {
        // Parse the current files with the server
        const files: string[] = [];
        for (let i = 0; i < fileList.length; ++i) {
            files.push(fileList[i].path);
        }
        const verifiedFiles = await lastValueFrom(ipcService.sendV2(
            "bs-mods.verify-external-mod-files",
            { version, files }
        ));
        if (verifiedFiles.length === 0) {
            notification.notifyError({
                title: "notifications.mods.external-mod.titles.install-error",
                desc: "notifications.mods.external-mod.msgs.verify-error"
            });
            return;
        }

        const conflictModIds = [...new Set(
            verifiedFiles
                .map(file => file.conflicts)
                .filter(file => file)
        )];

        // Overwrite the existing mod
        let existingMod: ExternalMod | undefined;
        if (conflictModIds.length === 1) {
            existingMod = modsExternal[conflictModIds[0]];
        }

        const modalResponse = await modals.openModal(ExternalModModal, { data: {
            name: existingMod?.name || fileList[0].name,
            version: existingMod?.version,
            description: existingMod?.description,
            files: verifiedFiles,
            type: existingMod ? ExternalModModalType.EXISTING : ExternalModModalType.INSTALL
        }});
        if (modalResponse.exitCode === ModalExitCode.CANCELED) {
            notification.notifyError({
                title: "notifications.mods.external-mod.titles.install-error",
                desc: "notifications.mods.external-mod.msgs.install-error"
            });
            return;
        }

        if (modalResponse.exitCode !== ModalExitCode.COMPLETED) {
            return;
        }

        if (existingMod) {
            modalResponse.data.id = existingMod.id;
        }

        const externalMod = await lastValueFrom(ipcService.sendV2("bs-mods.install-external-mod", {
            version,
            mod: modalResponse.data,
            files
        }));
        if (!externalMod.id) {
            notification.notifyError({
                title: "notifications.mods.external-mod.titles.install-error",
                desc: "notifications.mods.external-mod.msgs.install-error"
            });
            return;
        }

        notification.notifySuccess({
            title: "notifications.mods.external-mod.titles.install-success",
            desc: "notifications.mods.external-mod.msgs.install-success",
            duration: 10_000
        });
        setModsExternal({ ...modsExternal, [externalMod.id]: externalMod });
    }

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
            <Dropzone
                className="overflow-y-scroll scrollbar-default"
                onDrop={event => {
                    onFileDrop(event.dataTransfer.files);
                }}
                overlay={
                    <div className="text-3xl pointer-events-none">
                        Drop mod files here 😃
                    </div>
                }
            >

                <div className="grow w-full min-h-0 p-0 pb-14 m-0">
                    <ModsGrid
                        modsMap={modsAvailable}
                        modsInstalled={modsInstalled}
                        modsExternal={modsExternal}
                        modsSelected={modsSelected}
                        onModChange={handleModChange}
                        moreInfoMod={moreInfoMod}
                        onWantInfos={handleMoreInfo}
                        onExternalModCheckboxToggle={handleExternalModCheckboxToggle}
                        onExternalModDoubleClick={handleExternalModDoubleClick}
                        onExternalModUninstall={handleExternalModUninstall}
                    />
                </div>
                <div className="flex items-center justify-between absolute bottom-0 w-full shrink-0 px-3 py-2 z-10 bg-light-main-color-2 dark:bg-main-color-2">
                    <BsmButton
                        className="flex items-center justify-center rounded-md px-1 h-8"
                        text="pages.version-viewer.mods.buttons.more-infos"
                        typeColor="cancel"
                        withBar={false}
                        disabled={!moreInfoMod}
                        onClick={handleOpenMoreInfo}
                        style={{ width: downloadWith }}
                    />

                    <div className="flex items-center gap-x-2">
                        <BsmButton
                            className="flex items-center justify-center rounded-md px-1 h-8"
                            text="pages.version-viewer.mods.buttons.enable-or-disable"
                            typeColor="secondary"
                            withBar={false}
                            onClick={toggleMods}
                            style={{ width: downloadWith }}
                        />

                        <div ref={downloadRef} className="flex h-8 justify-center items-center gap-px overflow-hidden rounded-md">
                            <div className="grow h-full relative">
                                <BsmButton
                                    className="relative left-0 flex items-center justify-center px-2 size-full transition-[top] duration-200 ease-in-out"
                                    text="pages.version-viewer.mods.buttons.install-or-update"
                                    typeColor="primary"
                                    withBar={false}
                                    onClick={() => installMods(false)}
                                    style={{ top: reinstallAllMods ? "-100%" : "0" }}
                                />
                                <BsmButton
                                    className="relative left-0 flex items-center justify-center px-2 size-full transition-[top] duration-200 ease-in-out "
                                    text="pages.version-viewer.mods.buttons.reinstall-all"
                                    typeColor="primary"
                                    withBar={false}
                                    onClick={() => installMods(true)}
                                    style={{ top: reinstallAllMods ? "-100%" : "0" }}
                                />
                            </div>
                            <BsmButton
                                className="flex items-center justify-center shrink-0 h-full"
                                iconClassName="transition-transform size-full ease-in-out duration-200"
                                iconStyle={{ transform: reinstallAllMods ? "rotate(360deg)" : "rotate(180deg)" }}
                                icon="chevron-top"
                                typeColor="primary"
                                withBar={false}
                                onClick={() => setReinstallAllMods(prev => !prev)}
                            />
                        </div>
                    </div>
                    <BsmButton className="flex items-center justify-center shrink-0 h-full" iconClassName="transition-transform size-full ease-in-out duration-200" iconStyle={{ transform: reinstallAllMods ? "rotate(360deg)" : "rotate(180deg)" }} icon="chevron-top" typeColor="primary" withBar={false} onClick={() => setReinstallAllMods(prev => !prev)}/>
                </div>
                <BsmButton className="flex items-center justify-center shrink-0 h-full" iconClassName="transition-transform size-full ease-in-out duration-200" iconStyle={{ transform: reinstallAllMods ? "rotate(360deg)" : "rotate(180deg)" }} icon="chevron-top" typeColor="primary" withBar={false} onClick={() => setReinstallAllMods(prev => !prev)}/>
            </Dropzone>
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
