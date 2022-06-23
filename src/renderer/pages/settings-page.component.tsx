import { useEffect, useState } from "react";
import SettingColorChooser from "renderer/components/settings/setting-color-chooser.component";
import { SettingContainer } from "renderer/components/settings/setting-container.component";
import { RadioItem, SettingRadioArray } from "renderer/components/settings/setting-radio-array.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { ConfigurationService } from "renderer/services/configuration.service"

export function SettingsPage() {

  const configService = ConfigurationService.getInstance();

  const [firstColor, setFirstColor] = useState("#fff");
  const [secondColor, setSecondColor] = useState("#fff");

  const[themeIdSelected, setThemeIdSelected]= useState(0);

  useEffect(() => {
    const [fColorObs, sColorObs] = [configService.watch("first-color"), configService.watch("second-color")];
    const fColorSub = fColorObs.subscribe(color => setFirstColor(color));
    const sColorSub = sColorObs.subscribe(color => setSecondColor(color));
  
    return () => {
      configService.stopWatch("first-color" as DefaultConfigKey, fColorObs);
      configService.stopWatch("second-color" as DefaultConfigKey, sColorObs);

      [fColorSub, sColorSub].forEach(s => s.unsubscribe());
    }
  }, []);

  const themeItem: RadioItem[] = [
    {id: 0, text: "Dark"},
    {id: 1, text: "Light"},
    {id: 3, text: "Operating System"}
  ]

  const resetColors = () => {
    configService.delete("first-color" as DefaultConfigKey);
    configService.delete("second-color" as DefaultConfigKey);
  }

  const setFirstColorSetting = (hex: string) => configService.set("first-color", hex);
  const setSecondColorSetting = (hex: string) => configService.set("second-color", hex);



  return (
    <div className="w-full flex justify-center px-40 pt-10 text-gray-200">

      <div className="w-fit">

        <SettingContainer title="Steam Logout" description="If you logout of your Steam account, you must reconect for download a new BS instance">
          <BsmButton className="bg-red-500 w-fit px-3 py-[2px] rounded-md hover:brightness-75" withBar={false} text="Logout of Steam"/>
        </SettingContainer>

        <SettingContainer title="Appearance" description="Choose the two primary colors of BSManager">
          <div className="relative w-full h-8 bg-main-color-1 flex justify-center rounded-md py-1">
            <SettingColorChooser color={firstColor} onChange={setFirstColorSetting}/>
            <SettingColorChooser color={secondColor} onChange={setSecondColorSetting}/>
            <div className="absolute right-[6px] top-0 h-full flex items-center">
              <BsmButton onClick={resetColors} className=" px-2 font-bold italic text-sm rounded-md" text="Reset" withBar={false}/>
            </div>
          </div>
          <SettingContainer minorTitle="Theme" className="mt-3">
            <SettingRadioArray items={themeItem} selectedItem={themeIdSelected} onItemSelected={(id) => setThemeIdSelected(id)}/>
          </SettingContainer>
        </SettingContainer>

      </div>

      


      {/* <HexColorPicker onChange={setFirstColorSetting}/>
      <HexColorPicker onChange={setSecondColorSetting}/> */}
    </div>
  )
}
