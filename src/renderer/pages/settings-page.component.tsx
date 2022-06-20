import { HexColorPicker } from "react-colorful"
import { ConfigurationService } from "renderer/services/configuration.service"

export function SettingsPage() {

  const configService = ConfigurationService.getInstance();

  const setFirstColorSetting = (hex: string) => {
    configService.set("first-color", hex);
  }

  const setSecondColorSetting = (hex: string) => {
    configService.set("second-color", hex);
  }

  return (
    <div>
      <HexColorPicker onChange={setFirstColorSetting}/>
      <HexColorPicker onChange={setSecondColorSetting}/>
    </div>
  )
}
