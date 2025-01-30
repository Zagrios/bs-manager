import { BSVersion } from "shared/bs-version.interface";
import { useRef, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { TabNavBar } from "renderer/components/shared/tab-nav-bar.component";
import { BsmDropdownButton } from "renderer/components/shared/bsm-dropdown-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BSUninstallerService } from "../services/bs-uninstaller.service";
import { BSVersionManagerService } from "../services/bs-version-manager.service";
import { ModalExitCode, ModalService } from "../services/modale.service";
import DefautVersionImage from "../../../assets/images/default-version-img.jpg";
import { IpcService } from "renderer/services/ipc.service";
import { LaunchSlide } from "renderer/components/version-viewer/slides/launch/launch-slide.component";
import { ModsSlide, ModsSlideRef } from "renderer/components/version-viewer/slides/mods/mods-slide.component";
import { UninstallModal } from "renderer/components/modal/modal-types/uninstall-modal.component";
import { MapsPlaylistsPanel } from "renderer/components/maps-playlists-panel/maps-playlists-panel.component";
import { ShareFoldersModal } from "renderer/components/modal/modal-types/share-folders-modal.component";
import { ModelsPanel } from "renderer/components/models-management/models-panel.component";
import { useService } from "renderer/hooks/use-service.hook";
import { BSLauncherService } from "renderer/services/bs-launcher.service";
import { CreateLaunchShortcutModal } from "renderer/components/modal/modal-types/create-launch-shortcut-modal.component";
import { lastValueFrom } from "rxjs";
import { NotificationService } from "renderer/services/notification.service";
import { BsDownloaderService } from "renderer/services/bs-version-download/bs-downloader.service";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { safeLt } from "shared/helpers/semver.helpers";
import { ConfigurationService } from "renderer/services/configuration.service";
import { logRenderError } from "renderer";
import { BsModsManagerService } from "renderer/services/bs-mods-manager.service";
import { noop } from "shared/helpers/function.helpers";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";

export function VersionViewer() {

    const { text: t } = useTranslationV2();

    const bsUninstallerService = useService(BSUninstallerService);
    const bsVersionManagerService = useService(BSVersionManagerService);
    const modalService = useService(ModalService);
    const modsService = useService(BsModsManagerService);
    const bsDownloader = useService(BsDownloaderService);
    const ipcService = useService(IpcService);
    const bsLauncher = useService(BSLauncherService);
    const notification = useService(NotificationService);
    const config = useService(ConfigurationService);

    const { state, pathname: url } = useLocation() as { state: BSVersion; pathname: string };
    const navigate = useNavigate();
    const [currentTabIndex, setCurrentTabIndex] = useState(0);
    const modsSlideRef = useRef<ModsSlideRef>(null);

    useOnUpdate(() => {

        checkIsVersionOutaded();
        checkOutdatedMods();

    }, [state]);

    const checkIsVersionOutaded = async () => {

        if(config.get("not-show-bs-version-outdated-notification")){
            return;
        }

        const recommended = bsVersionManagerService.getRecommendedVersion();
        const isOutdated = safeLt(state.BSVersion, recommended?.BSVersion);

        if(!isOutdated){
            return;
        }

        const res = await notification.notifyWarning({ title: "notifications.bs-version-oudated.title", desc: "notifications.bs-version-oudated.msg", duration: 9000, actions: [
            { id: "0", title: "notifications.bs-version-oudated.actions.do-not-remind" },
            { id: "1", title: "notifications.bs-version-oudated.actions.ok", cancel: true }
        ] });

        if(res === "0"){
            config.set("not-show-bs-version-outdated-notification", true);
        }
    }

    const checkOutdatedMods = async () => {

        if(config.get("not-show-outdated-mods-notification")){
            return;
        }

        const { available: availableMods, installed: installedMods } = await modsService.getVersionModsState(state);

        const modsToUpdate = availableMods.filter(availableMod => {
            const installedMod = installedMods.find(installedMod => installedMod.mod.id === availableMod.mod.id);
            return installedMod && safeLt(installedMod.version.modVersion, availableMod.version.modVersion);
        });

        if(!modsToUpdate.length){
            return;
        }

        const choice = await notification.notifyInfo({
            title: modsToUpdate.length > 1 ?  t("pages.version-viewer.mods.notifications.outdated-mods.title-plural") : t("pages.version-viewer.mods.notifications.outdated-mods.title"),
            desc: modsToUpdate.length > 1 ? t("pages.version-viewer.mods.notifications.outdated-mods.description-plural", { nb: `${modsToUpdate.length}` }) : t("pages.version-viewer.mods.notifications.outdated-mods.description", { name: `${modsToUpdate[0].mod.name}` }),
            duration: 9000,
            actions: [
                { id: "0", title: "pages.version-viewer.mods.notifications.outdated-mods.dont-remind-me", cancel: true },
                { id: "1", title: "pages.version-viewer.mods.notifications.outdated-mods.update" }
            ]
        });

        if(choice === "1"){
            lastValueFrom(modsService.installMods(modsToUpdate, state)).then(() => {
                modsSlideRef?.current?.loadMods?.();
            }).catch(noop);
        } else if(choice === "0"){
            config.set("not-show-outdated-mods-notification", true);
        }
    }

    const navigateToVersion = (version?: BSVersion) => {
        if (!version) {
            return navigate("/available-versions");
        }
        navigate(`/bs-version/${version.BSVersion}`, { state: version });
    };
    const openFolder = () => lastValueFrom(ipcService.sendV2("bs-version.open-folder", state));
    const verifyFiles = () => bsDownloader.verifyBsVersion(state);

    const uninstall = async () => {
        const modalCompleted = await modalService.openModal(UninstallModal, { data: state });
        if (modalCompleted.exitCode === ModalExitCode.COMPLETED) {
            bsUninstallerService.uninstall(state).then(() => {
                bsVersionManagerService.askInstalledVersions().then(versions => {
                    navigateToVersion(versions?.at(0));
                });
            });
        }
    };

    const edit = () => {
        bsVersionManagerService.editVersion(state).then(newVersion => {
            if (!newVersion) {
                return;
            }
            navigateToVersion(newVersion);
        });
    };

    const clone = () => {
        bsVersionManagerService.cloneVersion(state).then(newVersion => {
            if (!newVersion) {
                return;
            }
            navigateToVersion(newVersion);
        });
    };

    const handleModsDisclaimerDecline = () => {
        setCurrentTabIndex(() => 0);
    };

    const openShareFolderModal = () => {
        modalService.openModal(ShareFoldersModal, {data: state});
    };

    const createLaunchShortcut = async () => {
        const { exitCode, data } = await modalService.openModal(CreateLaunchShortcutModal, {data: state});
        if(exitCode !== ModalExitCode.COMPLETED){ return; }

        lastValueFrom(bsLauncher.createLaunchShortcut(data.launchOption, data.steamShortcut)).then(() => {
            notification.notifySuccess({
                title: "notifications.create-launch-shortcut.success.title",
                desc: `notifications.create-launch-shortcut.success.${data.steamShortcut ? "msg-steam" : "msg"}`
            });
        }).catch(error => {
            notification.notifyError({
                title: "notifications.types.error",
                desc: "notifications.create-launch-shortcut.error.msg",
            }, error);
        });
    }

    // If state/version is not properly set, or becomes null for some reason
    //   redirect user to the available-versions page
    if (!state) {
        logRenderError(`Missing state/version for "${url}"`);
        return <Navigate to="/available-versions" replace />;
    }

    return (
        <>
            <BsmImage className="absolute w-full h-full top-0 left-0 object-cover" image={state.ReleaseImg || DefautVersionImage} errorImage={DefautVersionImage} />
            <div className="relative flex items-center flex-col w-full h-full text-gray-200 backdrop-blur-lg">
                <TabNavBar className="my-4" tabIndex={currentTabIndex} tabsText={["misc.launch", "misc.maps", "misc.models", "misc.mods"]} onTabChange={(i: number) => setCurrentTabIndex(i)} />
                <div className="w-full min-h-0 grow flex transition-transform duration-300" style={{ transform: `translate(${-(currentTabIndex * 100)}%, 0)` }}>
                    <LaunchSlide version={state} />
                    <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
                        <MapsPlaylistsPanel version={state} isActive={currentTabIndex === 1} />
                    </div>
                    <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
                        <ModelsPanel version={state} isActive={currentTabIndex === 2} goToMods={() => setCurrentTabIndex(() => 3)} />
                    </div>
                    <ModsSlide ref={modsSlideRef} version={state} isActive={currentTabIndex === 3} onDisclamerDecline={handleModsDisclaimerDecline} />
                </div>
            </div>
            <BsmDropdownButton className="absolute top-3 right-4 h-9 w-9 bg-light-main-color-2 dark:bg-main-color-2 rounded-md" items={[
                { text: "pages.version-viewer.dropdown.open-folder", icon: "folder", onClick: openFolder },
                { text: "pages.version-viewer.dropdown.verify-files", icon: "task", onClick: verifyFiles },
                !state.steam && !state.oculus && { text: "pages.version-viewer.dropdown.edit", icon: "edit", onClick: edit },
                !state.oculus && { text: "pages.version-viewer.dropdown.clone", icon: "copy", onClick: clone },
                { text: "pages.version-viewer.dropdown.shared-folders", icon: "link", onClick: openShareFolderModal },
                { text: "pages.version-viewer.dropdown.create-shortcut", icon: "shortcut", onClick: createLaunchShortcut },
                !state.steam && !state.oculus && { text: "pages.version-viewer.dropdown.uninstall", icon: "trash", onClick: uninstall }]} />
        </>
    );
}
