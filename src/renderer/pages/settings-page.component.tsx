import { Dispatch, SetStateAction, useEffect, useState } from "react";
import SettingColorChooser from "renderer/components/settings/setting-color-chooser.component";
import { SettingContainer } from "renderer/components/settings/setting-container.component";
import { RadioItem, SettingRadioArray } from "renderer/components/settings/setting-radio-array.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmIconType } from "renderer/components/svgs/bsm-icon.component";
import { DefaultConfigKey, ThemeConfig } from "renderer/config/default-configuration.config";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { AuthUserService } from "renderer/services/auth-user.service";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { ConfigurationService } from "renderer/services/configuration.service"
import { I18nService } from "renderer/services/i18n.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { NotificationService } from "renderer/services/notification.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { SupportersView } from "renderer/components/settings/supporters-view/supporters-view.component";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { useNavigate } from "react-router-dom";
import { InstallationFolderModal } from "renderer/components/modal/modal-types/installation-folder-modal.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import modelSaberIcon from "../../../assets/images/third-party-icons/model-saber.svg";
import beatSaverIcon from "../../../assets/images/third-party-icons/beat-saver.png";
import beastSaberIcon from "../../../assets/images/third-party-icons/beast-saber.png";
import scoreSaberIcon from "../../../assets/images/third-party-icons/score-saber.png";
import Tippy from '@tippyjs/react';
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { ModelsManagerService } from "renderer/services/models-manager.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function SettingsPage() {

  const configService: ConfigurationService = ConfigurationService.getInstance();
  const themeService: ThemeService = ThemeService.getInstance();
  const ipcService: IpcService = IpcService.getInstance();
  const modalService: ModalService = ModalService.getInsance();
  const downloaderService: BsDownloaderService = BsDownloaderService.getInstance();
  const progressBarService: ProgressBarService = ProgressBarService.getInstance();
  const authService: AuthUserService = AuthUserService.getInstance();
  const notificationService: NotificationService = NotificationService.getInstance();
  const i18nService: I18nService = I18nService.getInstance();
  const linkOpener: LinkOpenerService = LinkOpenerService.getInstance();
  const mapsManager = MapsManagerService.getInstance();
  const playlistsManager = PlaylistsManagerService.getInstance();
  const modelsManager = ModelsManagerService.getInstance();

  const {firstColor, secondColor} = useThemeColor();
  const sessionExist = useObservable(authService.sessionExist$);

  const themeItem: RadioItem[] = [
    {id: 0, text: "pages.settings.appearance.themes.dark", value: "dark" as ThemeConfig},
    {id: 1, text: "pages.settings.appearance.themes.light", value: "light" as ThemeConfig},
    {id: 3, text: "pages.settings.appearance.themes.os", value: "os" as ThemeConfig}
  ];

  const languagesItems: RadioItem[] = i18nService.getSupportedLanguages().map((l, index) => {
    return {id: index, text: `pages.settings.language.languages.${l}`, value: l, textIcon:`pages.settings.language.languages.translated.${l}`, icon: `${l}-flag` as BsmIconType};
  }).sort((a, b) => a.text.localeCompare(b.text));

  const[themeIdSelected, setThemeIdSelected]= useState(themeItem.find(e => e.value === themeService.getTheme()).id);
  const[languageSelected, setLanguageSelected]= useState(languagesItems.find(e => e.value === i18nService.currentLanguage).id);
  const [installationFolder, setInstallationFolder] = useState(null);
  const [showSupporters, setShowSupporters] = useState(false);
  const [mapDeepLinksEnabled, setMapDeepLinksEnabled] = useState(false);
  const [playlistsDeepLinkEnabled, setPlaylistsDeepLinkEnabled] = useState(false);
  const [modelsDeepLinkEnabled, setModelsDeepLinkEnabled] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const nav = useNavigate();
  const t = useTranslation();

  useEffect(() => {
    loadInstallationFolder();
    ipcService.send<string>("current-version").then(res => setAppVersion(res.data));
    mapsManager.isDeepLinksEnabled().then(enabled => setMapDeepLinksEnabled(() => enabled));
    playlistsManager.isDeepLinksEnabled().then(enabled => setPlaylistsDeepLinkEnabled(() => enabled));
    modelsManager.isDeepLinksEnabled().then(enabled => setModelsDeepLinkEnabled(() => enabled))
  }, []);

  const allDeepLinkEnabled = mapDeepLinksEnabled && playlistsDeepLinkEnabled && modelsDeepLinkEnabled;

  const resetColors = () => {
    configService.delete("first-color" as DefaultConfigKey);
    configService.delete("second-color" as DefaultConfigKey);
  }

  const loadInstallationFolder = () => {
    downloaderService.getInstallationFolder().then(res => setInstallationFolder(res));
  }

  const setFirstColorSetting = (hex: string) => configService.set("first-color", hex);
  const setSecondColorSetting = (hex: string) => configService.set("second-color", hex);

  const handleChangeTheme = (id: number) => {
    setThemeIdSelected(id);
    themeService.setTheme(themeItem.find(e => e.id === id).value);
  }

  const handleChangeLanguage = (id: number) => {
    const selectedLanguage = languagesItems.find(l => l.id === id).value;
    i18nService.setLanguage(selectedLanguage);
    setLanguageSelected(languagesItems.find(l => l.value === i18nService.currentLanguage).id);
  }

  const setDefaultInstallationFolder = () => {
      if(!progressBarService.require()){ return; }

      modalService.openModal(InstallationFolderModal).then(async res => {
         if(res.exitCode !== ModalExitCode.COMPLETED){ return; }
         const fileChooserRes = await ipcService.send<{canceled: boolean, filePaths: string[]}>("choose-folder");

         if(fileChooserRes.success && !fileChooserRes.data.canceled && fileChooserRes.data.filePaths?.length){
            progressBarService.showFake(.008);
            downloaderService.setInstallationFolder(fileChooserRes.data.filePaths[0]).then(res => {
               setTimeout(() => {
                  progressBarService.complete();
                  setTimeout(() => progressBarService.hide(true), 1000);
               }, 1000);
               if(res.success){
                  setInstallationFolder(res.data);
                  notificationService.notifySuccess({title: "notifications.settings.move-folder.success.titles.transfer-finished", duration: 3000});
               }
               else{
                  notificationService.notifyError({title: "notifications.settings.move-folder.errors.titles.transfer-failed"});
               }
            });
         }

      });
   }

  const deleteSteamSession = () => {
    if(!sessionExist){ return; }
    authService.deleteSteamSession();
    notificationService.notifySuccess({title: "notifications.settings.steam.success.titles.logout", duration: 3000});
  };

  
  const toogleShowSupporters = () => {
      setShowSupporters(show => !show);
    }
    
  const openSupportPage = () => linkOpener.open("https://mee6.gg/m/bsmanager");
  const openGithub = () => linkOpener.open("https://github.com/Zagrios/bs-manager");
  const openReportBug = () => linkOpener.open("https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=bug&template=-bug--bug-report.md&title=%5BBUG%5D+%3A+");
  const openRequestFeatures = () => linkOpener.open("https://github.com/Zagrios/bs-manager/issues/new?assignees=Zagrios&labels=enhancement&template=-feat---feature-request.md&title=%5BFEAT.%5D+%3A+");
  const openDiscord = () => linkOpener.open("https://discord.gg/uSqbHVpKdV");
  const openTwitter = () => linkOpener.open("https://twitter.com/BSManager_");

  const openLogs = () => ipcService.sendLazy("open-logs");

    const showDeepLinkError = (isDeactivation: boolean) => {
        const desc = isDeactivation ? "notifications.settings.additional-content.deep-link.deactivation.error.description" : "notifications.settings.additional-content.deep-link.activation.error.description";
        notificationService.notifyError({title: "notifications.types.error", desc, duration: 3000});
    }

    const showDeepLinkSuccess = (isDeactivation: boolean) => {
        const desc = isDeactivation ? "notifications.settings.additional-content.deep-link.deactivation.success.description" : "notifications.settings.additional-content.deep-link.activation.success.description";
        const title = isDeactivation ? "notifications.settings.additional-content.deep-link.deactivation.success.title" : "notifications.settings.additional-content.deep-link.activation.success.title";
        notificationService.notifySuccess({title, desc, duration: 3000});
    }

    const switchDeepLink = async (manager: MapsManagerService|PlaylistsManagerService|ModelsManagerService, enable: boolean, showNotification: boolean, setter: Dispatch<SetStateAction<boolean>>) => {
        const res = await (enable ? manager.enableDeepLink() : manager.disableDeepLink());
        showNotification && (res ? showDeepLinkSuccess(!enable) : showDeepLinkError(!enable));
        const isEnable = await manager.isDeepLinksEnabled()
        setter(() => isEnable)
        return res;
    }

    const toogleMapDeepLinks = (showNotification = true) => switchDeepLink(mapsManager, !mapDeepLinksEnabled, showNotification, setMapDeepLinksEnabled);
    const tooglePlaylistsDeepLinks = (showNotification = true) => switchDeepLink(playlistsManager, !playlistsDeepLinkEnabled, showNotification, setPlaylistsDeepLinkEnabled);
    const toogleModelsDeepLinks = (showNotification = true) => switchDeepLink(modelsManager, !modelsDeepLinkEnabled, showNotification, setModelsDeepLinkEnabled);
    const toogleAllDeepLinks = async () => {
        const res = (await Promise.all([
            switchDeepLink(mapsManager, !allDeepLinkEnabled, false, setMapDeepLinksEnabled),
            switchDeepLink(playlistsManager, !allDeepLinkEnabled, false, setPlaylistsDeepLinkEnabled),
            switchDeepLink(modelsManager, !allDeepLinkEnabled, false, setModelsDeepLinkEnabled)
        ])).every(activation => activation === true);

        res ? showDeepLinkSuccess(allDeepLinkEnabled) : showDeepLinkError(allDeepLinkEnabled);
    };

    return (
        <div className="w-full h-full flex justify-center overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 text-gray-800 dark:text-gray-200">

            

            <div className="max-w-2xl w-full h-fit">

                <div className="inline-block sticky top-8 left-[calc(100%)] translate-x-12 grow-0 w-9 h-9">
                    <BsmButton className="inline-block grow-0 bg-transparent sticky h-full w-full top-20 right-20 !m-0 rounded-full p-1" onClick={() => nav(-1)} icon="close" withBar={false}/>
                </div>

                <SettingContainer title="pages.settings.steam.title" description="pages.settings.steam.description">
                    <BsmButton onClick={deleteSteamSession} className="w-fit px-3 py-[2px] text-white rounded-md" withBar={false} text="pages.settings.steam.logout" typeColor="error" disabled={!sessionExist}/>
                </SettingContainer>

                <SettingContainer title="pages.settings.appearance.title" description="pages.settings.appearance.description">
                    <div className="relative w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 flex justify-center rounded-md py-1">
                        <SettingColorChooser color={firstColor} onChange={setFirstColorSetting}/>
                        <SettingColorChooser color={secondColor} onChange={setSecondColorSetting}/>
                        <div className="absolute right-2 top-0 h-full flex items-center">
                            <BsmButton onClick={resetColors} className="px-2 font-bold italic text-sm rounded-md" text="pages.settings.appearance.reset" withBar={false}/>
                        </div>
                    </div>
                    <SettingContainer minorTitle="pages.settings.appearance.sub-title" className="mt-3">
                        <SettingRadioArray items={themeItem} selectedItem={themeIdSelected} onItemSelected={handleChangeTheme}/>
                    </SettingContainer>
                </SettingContainer>

                <SettingContainer title="pages.settings.installation-folder.title" description="pages.settings.installation-folder.description">
                    <div className="relative flex items-center justify-between w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
                        <span className="block text-ellipsis overflow-hidden min-w-0" title={installationFolder}>{installationFolder}</span>
                        <BsmButton onClick={setDefaultInstallationFolder} className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md" text="pages.settings.installation-folder.choose-folder" withBar={false}/>
                    </div>
                </SettingContainer>

                <SettingContainer title="pages.settings.additional-content.title" description="pages.settings.additional-content.description">

                <SettingContainer id="one-clicks" minorTitle="pages.settings.additional-content.deep-links.sub-title">
                    <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md group-one flex justify-between items-center basis-0 py-2 px-3 cursor-pointer mb-1.5" onClick={toogleAllDeepLinks}>
                            <div className="flex items-center gap-2">
                                <BsmCheckbox className="relative z-[1] h-5 w-5" onChange={toogleAllDeepLinks} checked={allDeepLinkEnabled}/>
                                <span className="font-extrabold">{t("notifications.settings.additional-content.deep-link.select-all")}</span>
                            </div>
                            <div className="flex h-full gap-2">
                                <Tippy content="BeatSaver" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={beatSaverIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://beatsaver.com/")}}/>
                                </Tippy>
                                <Tippy content="BeastSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 rounded-md cursor-pointer" image={beastSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://bsaber.com/")}}/>
                                </Tippy>
                                <Tippy content="ScoreSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={scoreSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://scoresaber.com/")}}/>
                                </Tippy>
                                <Tippy content="ModelSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={modelSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://modelsaber.com/")}}/>
                                </Tippy>
                            </div>
                    </div>
                    <ul className="w-full flex flex-col gap-1.5 pl-10">
                        <li className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md group-one flex justify-between items-center basis-0 py-2 px-3 cursor-pointer" onClick={() => toogleMapDeepLinks()}>
                            <div className="flex items-center gap-2">
                                <BsmCheckbox className="relative z-[1] h-5 w-5" onChange={() => toogleMapDeepLinks()} checked={mapDeepLinksEnabled}/>
                                <span className="font-extrabold">{t("misc.maps")}</span>
                            </div>
                            <div className="flex h-full gap-2">
                                <Tippy content="BeatSaver" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={beatSaverIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://beatsaver.com/")}}/>
                                </Tippy>
                                <Tippy content="BeastSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 rounded-md cursor-pointer" image={beastSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://bsaber.com/")}}/>
                                </Tippy>
                                <Tippy content="ScoreSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={scoreSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://scoresaber.com/")}}/>
                                </Tippy>
                            </div>
                        </li>
                        <li className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md group-one flex justify-between items-center basis-0 py-2 px-3 cursor-pointer" onClick={() => tooglePlaylistsDeepLinks()}>
                            <div className="flex items-center gap-2">
                                <BsmCheckbox className="relative z-[1] h-5 w-5" onChange={() => tooglePlaylistsDeepLinks()} checked={playlistsDeepLinkEnabled}/>
                                <span className="font-extrabold">{t("misc.playlists")}</span>
                            </div>
                            <div className="flex h-full">
                                <Tippy content="BeatSaver" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={beatSaverIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://beatsaver.com/")}}/>
                                </Tippy>
                            </div>
                        </li>
                        <li className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md group-one flex justify-between items-center basis-0 py-2 px-3 cursor-pointer" onClick={() => toogleModelsDeepLinks()}>
                            <div className="flex items-center gap-2">
                                <BsmCheckbox className="relative z-[1] h-5 w-5" onChange={() => toogleModelsDeepLinks()} checked={modelsDeepLinkEnabled}/>
                                <span className="font-extrabold">{t("misc.models")}</span>
                            </div>
                            <div className="flex h-full">
                                <Tippy content="ModelSaber" placement="top" className="font-bold bg-main-color-3" arrow={false} duration={[200, 0]}>
                                    <BsmImage className="h-8 cursor-pointer" image={modelSaberIcon} onClick={e => {e.stopPropagation(); linkOpener.open("https://modelsaber.com/")}}/>
                                </Tippy>
                            </div>
                        </li>
                    </ul>
                </SettingContainer>
                    
                </SettingContainer>

                <SettingContainer title="pages.settings.language.title" description="pages.settings.language.description">
                    <SettingRadioArray items={languagesItems} selectedItem={languageSelected} onItemSelected={handleChangeLanguage}/>
                </SettingContainer>

                <SettingContainer title="pages.settings.patreon.title" description="pages.settings.patreon.description">
                    <div className="flex gap-2">
                        <BsmButton disabled color="#ef4444" className="flex w-fit rounded-md h-8 px-2 font-bold py-1 whitespace-nowrap !text-white" text="pages.settings.patreon.buttons.support" withBar={false} onClick={openSupportPage}/>
                        <BsmButton className="flex w-fit rounded-md h-8 px-2 font-bold py-1 !text-white" withBar={false} text="pages.settings.patreon.buttons.supporters" color="#6c5ce7" onClick={toogleShowSupporters}/>
                    </div>
                    <SettingContainer className="mt-3" description="pages.settings.discord.description">
                        <div className="flex gap-2">
                            <BsmButton className="flex w-fit rounded-md h-8 px-2 font-bold py-1 !text-white" withBar={false} text="Discord" icon="discord" iconClassName="p-0.5 mr-1" color="#5865f2" onClick={openDiscord}/>
                            <BsmButton className="flex w-fit rounded-md h-8 px-2 font-bold py-1 !text-white" withBar={false} text="Twitter" icon="twitter" iconClassName="p-0.5 mr-1" color="#1A8CD8" onClick={openTwitter}/>
                        </div>
                    </SettingContainer>
                    <SettingContainer className="pt-3" description="pages.settings.contribution.description">
                        <div className="flex items-center justify-between w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
                            <div className="flex">
                                <BsmButton onClick={openRequestFeatures} className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md" text="pages.settings.contribution.buttons.request-features" withBar={false}/>
                                <BsmButton onClick={openReportBug} className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md" text="pages.settings.contribution.buttons.report-bug" withBar={false}/>
                            </div>
                            <div className="flex px-2 gap-2">
                                <BsmButton onClick={openLogs} className="shrink-0 whitespace-nowrap px-2 font-bold italic text-sm rounded-md" text="pages.settings.contribution.buttons.open-logs" withBar={false}/>
                                <BsmButton onClick={openGithub} className="shrink-0 px-2 rounded-md" icon="github" title="GitHub" withBar={false}/>    
                            </div>
                        </div>
                    </SettingContainer>
                </SettingContainer>

                <span className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md py-1 px-2 font-bold float-right mb-5">v{appVersion}</span>

            </div>

            <SupportersView isVisible={showSupporters} setVisible={setShowSupporters}/>

        </div>
    )
}
