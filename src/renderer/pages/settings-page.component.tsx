import { useEffect, useState } from "react";
import SettingColorChooser from "renderer/components/settings/setting-color-chooser.component";
import { SettingContainer } from "renderer/components/settings/setting-container.component";
import { RadioItem, SettingRadioArray } from "renderer/components/settings/setting-radio-array.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { DefaultConfigKey, ThemeConfig } from "renderer/config/default-configuration.config";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BsDownloaderService } from "renderer/services/bs-downloader.service";
import { ConfigurationService } from "renderer/services/configuration.service"
import { IpcService } from "renderer/services/ipc.service";
import { ModalExitCode, ModalService, ModalType } from "renderer/services/modale.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { ThemeService } from "renderer/services/theme.service";

export function SettingsPage() {

  const configService = ConfigurationService.getInstance();
  const themeService = ThemeService.getInstance();
  const ipcService = IpcService.getInstance();
  const modalService = ModalService.getInsance();
  const downloaderService = BsDownloaderService.getInstance();
  const progressBarService = ProgressBarService.getInstance();

  const themeItem: RadioItem[] = [
    {id: 0, text: "Dark", value: "dark" as ThemeConfig},
    {id: 1, text: "Light", value: "light" as ThemeConfig},
    {id: 3, text: "Operating System", value: "os" as ThemeConfig}
  ];

  const firstColor = useObservable(configService.watch<string>("first-color"));
  const secondColor = useObservable(configService.watch<string>("second-color"));
  const[themeIdSelected, setThemeIdSelected]= useState(themeItem.find(e => e.value === themeService.getTheme()).id);
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
          if(res.success){ setInstallationFolder(res.data); }
        });
      }

    })
  }

  return (
    <div className="w-full flex justify-center px-40 pt-10 text-gray-800 dark:text-gray-200">

      <div className="w-fit max-w-full">

        <SettingContainer title="Steam" description="If you logout of your Steam account, you must reconect for download a new BS instance">
          <BsmButton className="bg-red-500 w-fit px-3 py-[2px] text-white rounded-md hover:brightness-90" withBar={false} text="Logout of Steam"/>
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

      </div>
    </div>
  )
}
