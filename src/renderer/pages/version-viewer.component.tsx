import { BSVersion } from 'shared/bs-version.interface';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TabNavBar } from 'renderer/components/shared/tab-nav-bar.component';
import { BsmDropdownButton } from 'renderer/components/shared/bsm-dropdown-button.component';
import { BsmImage } from 'renderer/components/shared/bsm-image.component';
import { BSUninstallerService } from '../services/bs-uninstaller.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service';
import { ModalExitCode, ModalService } from '../services/modale.service';
import DefautVersionImage from "../../../assets/images/default-version-img.jpg";
import { BsDownloaderService } from 'renderer/services/bs-downloader.service';
import { IpcService } from 'renderer/services/ipc.service';
import { LaunchSlide } from 'renderer/components/version-viewer/slides/launch/launch-slide.component';
import { ModsSlide } from 'renderer/components/version-viewer/slides/mods/mods-slide.component';
import { UninstallModal } from 'renderer/components/modal/modal-types/uninstall-modal.component';
import { MapsPlaylistsPanel } from 'renderer/components/maps-mangement-components/maps-playlists-panel.component';
import { ShareFoldersModal } from 'renderer/components/modal/modal-types/share-folders-modal.component';
import { ModelsPanel } from 'renderer/components/models-management/models-panel.component';

export function VersionViewer() {

    const bsUninstallerService = BSUninstallerService.getInstance();
    const bsVersionManagerService = BSVersionManagerService.getInstance();
    const modalService = ModalService.getInsance();
    const bsDownloaderService = BsDownloaderService.getInstance();
    const ipcService = IpcService.getInstance();

    const {state} = useLocation() as {state: BSVersion};
    const navigate = useNavigate();
    const [currentTabIndex, setCurrentTabIndex] = useState(0);

    const navigateToVersion = (version?: BSVersion) => {
        if(!version){
            return navigate("/available-versions");
        }
        navigate(`/bs-version/${version.BSVersion}`, {state: version});
    }
    const openFolder = () => ipcService.sendLazy("bs-version.open-folder", {args: state});
    const verifyFiles = () => bsDownloaderService.download(state, true);

    const uninstall = async () => {
        const modalCompleted = await modalService.openModal(UninstallModal, state);
        if(modalCompleted.exitCode === ModalExitCode.COMPLETED){
            bsUninstallerService.uninstall(state).then(() => {
                bsVersionManagerService.askInstalledVersions().then(versions => {
                    navigateToVersion(versions?.at(0));
                });
            })
        }
    }

    const edit = () => {
        bsVersionManagerService.editVersion(state).then(newVersion => {
            if(!newVersion){ return; }
            navigateToVersion(newVersion);
        });
    }

    const clone = () => {
        bsVersionManagerService.cloneVersion(state).then(newVersion => {
            if(!newVersion){ return; }
            navigateToVersion(newVersion);
        });
    }

    const handleModsDisclaimerDecline = () => {
        setCurrentTabIndex(() => 0);
    }

    const openShareFolderModal = () => {
        modalService.openModal(ShareFoldersModal, state);
    }


  return (
    <>
      <BsmImage className="absolute w-full h-full top-0 left-0 object-cover" image={state.ReleaseImg || DefautVersionImage} errorImage={DefautVersionImage}/>
      <div className="relative flex items-center flex-col w-full h-full text-gray-200 backdrop-blur-lg">
        <TabNavBar className='my-4' tabIndex={currentTabIndex} tabsText={["misc.launch", "misc.maps", "misc.models", "misc.mods"]} onTabChange={(i : number) => setCurrentTabIndex(i)}/>
        <div className='w-full min-h-0 grow flex transition-transform duration-300' style={{transform: `translate(${-(currentTabIndex * 100)}%, 0)`}}>
          <LaunchSlide version={state}/>
          <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
            <MapsPlaylistsPanel version={state}/>
          </div>
          <div className="w-full shrink-0 px-3 pb-3 flex flex-col items-center">
            <ModelsPanel version={state} isActive={currentTabIndex === 2} goToMods={() => setCurrentTabIndex(() => 3)}/>
          </div>
          <ModsSlide version={state} onDisclamerDecline={handleModsDisclaimerDecline}/>
        </div>
      </div>
      <BsmDropdownButton className='absolute top-3 right-4 h-9 w-9 bg-light-main-color-2 dark:bg-main-color-2 rounded-md' items={[
          {text: "pages.version-viewer.dropdown.open-folder", icon: "folder", onClick: openFolder},
          ((!state.steam && !state.oculus) && {text: "pages.version-viewer.dropdown.verify-files", icon: "task", onClick: verifyFiles}),
          ((!state.steam && !state.oculus) && {text: "pages.version-viewer.dropdown.edit", icon: "edit", onClick: edit}),
          (!state.oculus && {text: "pages.version-viewer.dropdown.clone", icon: "copy", onClick: clone}),
          {text: "pages.version-viewer.dropdown.shared-folders", icon: "link", onClick: openShareFolderModal},
          ((!state.steam && !state.oculus) && {text: "pages.version-viewer.dropdown.uninstall", icon:"trash", onClick: uninstall})
        ]}/>
    </>
  )
}