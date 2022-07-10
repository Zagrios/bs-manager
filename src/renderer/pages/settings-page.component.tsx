import { useEffect, useState } from "react";
import SettingColorChooser from "renderer/components/settings/setting-color-chooser.component";
import { SettingContainer } from "renderer/components/settings/setting-container.component";
import { RadioItem, SettingRadioArray } from "renderer/components/settings/setting-radio-array.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmIconType } from "renderer/components/svgs/bsm-icon.component";
import { DefaultConfigKey, ThemeConfig } from "renderer/config/default-configuration.config";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { AuthUserService } from "renderer/services/auth-user.service";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { ConfigurationService } from "renderer/services/configuration.service"
import { I18nService } from "renderer/services/i18n.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";
import { NotificationService } from "renderer/services/notification.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";

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

  const firstColor = useObservable(configService.watch<string>("first-color"));
  const secondColor = useObservable(configService.watch<string>("second-color"));
  const sessionExist = useObservable(authService.sessionExist$);
  const t = useTranslation();

  const themeItem: RadioItem[] = [
    {id: 0, text: "Dark", value: "dark" as ThemeConfig},
    {id: 1, text: "Light", value: "light" as ThemeConfig},
    {id: 3, text: "Operating System", value: "os" as ThemeConfig}
  ];

  const languagesItems: RadioItem[] = i18nService.getSupportedLanguages().map((l, index) => {
    return {id: index, text: t(`pages.settings.languages.${l}`), value: l, textIcon:t(`pages.settings.languages.translated.${l}`), icon: `${l}-flag` as BsmIconType};
  }).sort((a, b) => a.text.localeCompare(b.text));

  const[themeIdSelected, setThemeIdSelected]= useState(themeItem.find(e => e.value === themeService.getTheme()).id);
  const[languageSelected, setLanguageSelected]= useState(languagesItems.find(e => e.value === i18nService.currentLanguage).id);
  const [installationFolder, setInstallationFolder] = useState(null);

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
            notificationService.notifySuccess({title: "Transfer completed", duration: 3000});
          }
        });
      }

    })
  }

  const deleteSteamSession = () => {
    if(!sessionExist){ return; }
    authService.deleteSteamSession();
    notificationService.notifySuccess({title: "Disconnected from Steam", duration: 3000});
  };

  return (
    <div className="w-full h-full flex justify-center overflow-y-scroll pb-12 scrollbar-thin scrollbar-thumb-neutral-900 text-gray-800 dark:text-gray-200">

      <div className="w-fit max-w-full mt-10">

        <SettingContainer title="Steam" description="If you logout of your Steam account, you must reconect for download a new BS instance">
          <BsmButton onClick={deleteSteamSession} className={`bg-red-500 w-fit px-3 py-[2px] text-white rounded-md`} withBar={false} text="Logout of Steam" disabled={!sessionExist}/>
        </SettingContainer>

        <SettingContainer title="Appearance" description="Choose the two primary colors of BSManager">
          <div className="relative w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 flex justify-center rounded-md py-1">
            <SettingColorChooser color={firstColor} onChange={setFirstColorSetting}/>
            <SettingColorChooser color={secondColor} onChange={setSecondColorSetting}/>
            <div className="absolute right-2 top-0 h-full flex items-center">
              <BsmButton onClick={resetColors} className="px-2 font-bold italic text-sm rounded-md bg-light-main-color-2 dark:bg-main-color-2 hover:bg-light-main-color-3 dark:hover:bg-main-color-3" text="Reset" withBar={false}/>
            </div>
          </div>
          <SettingContainer minorTitle="Theme" className="mt-3">
            <SettingRadioArray items={themeItem} selectedItem={themeIdSelected} onItemSelected={handleChangeTheme}/>
          </SettingContainer>
        </SettingContainer>

        <SettingContainer title="Installation Folder" description="Change the default installation directory for Beat Saber instances, and other upcoming features.">
        <div className="relative flex items-center justify-between w-full h-8 bg-light-main-color-1 dark:bg-main-color-1 rounded-md pl-2 py-1">
          <span className="block text-ellipsis overflow-hidden min-w-0" title={installationFolder}>{installationFolder}</span>
          <BsmButton onClick={setDefaultInstallationFolder} className="shrink-0 whitespace-nowrap mr-2 px-2 font-bold italic text-sm rounded-md bg-light-main-color-2 dark:bg-main-color-2 hover:bg-light-main-color-3 dark:hover:bg-main-color-3" text="Choose Folder" withBar={false}/>
        </div>
        </SettingContainer>

        <SettingContainer title="Language" description="Select a language">
          <SettingRadioArray items={languagesItems} selectedItem={languageSelected} onItemSelected={handleChangeLanguage}/>
        </SettingContainer>

        <div className="h-10"></div>

      </div>
    </div>
  )
}
