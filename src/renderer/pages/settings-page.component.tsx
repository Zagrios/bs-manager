import { useEffect, useState } from "react";
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
import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";
import { NotificationService } from "renderer/services/notification.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";
import { SupportersView } from "renderer/components/settings/supporters-view/supporters-view.component";

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

  useEffect(() => {
    loadInstallationFolder();
  }, []);

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

      modalService.openModal(ModalType.INSTALLATION_FOLDER).then(async res => {
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

  const openPatreonPage = () => {
    ipcService.sendLazy("new-window", {args: "https://www.patreon.com/bsmanager?fan_landing=true"})
  }

  const toogleShowSupporters = () => {
    setShowSupporters(show => !show);
  }

    return (
        <div className="w-full h-full flex justify-center overflow-y-scroll scrollbar-thin scrollbar-thumb-neutral-900 text-gray-800 dark:text-gray-200">

            <div className="max-w-2xl w-full mt-10">

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

                <SettingContainer title="pages.settings.language.title" description="pages.settings.language.description">
                    <SettingRadioArray items={languagesItems} selectedItem={languageSelected} onItemSelected={handleChangeLanguage}/>
                </SettingContainer>

                <SettingContainer title="pages.settings.patreon.title" description="pages.settings.patreon.description">
                    <div className="flex">
                        <BsmButton className="flex w-fit rounded-md h-8 px-2 font-bold py-1 whitespace-nowrap mr-2 !text-white" iconClassName="mr-1" text="pages.settings.patreon.buttons.support" icon="patreon" color="#EC6350" withBar={false} onClick={openPatreonPage}/>
                        <BsmButton className="flex w-fit rounded-md h-8 px-2 font-bold py-1 !text-white" withBar={false} text="pages.settings.patreon.buttons.supporters" color="#6c5ce7" onClick={toogleShowSupporters}/>
                    </div>
                </SettingContainer>

                <div className="h-10"/>

            </div>

            <SupportersView isVisible={showSupporters} setVisible={setShowSupporters}/>

        </div>
    )
}
