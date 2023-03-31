import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalComponent } from "renderer/services/modale.service";
import BeatRunning from '../../../../../../assets/images/apngs/beat-running.png';
import { useEffect, useState } from "react";
import { I18nService } from "renderer/services/i18n.service";
import "./changelog-modal.component.css"
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { LinkOpenerService } from "renderer/services/link-opener.service";

const i18nService: I18nService = I18nService.getInstance();
  type jsonData = {
    title: string,
    body: string,
    version: string
  }

export const ChangelogModal: ModalComponent<void, void> = () => {

  const linkOpener: LinkOpenerService = LinkOpenerService.getInstance();
  const openGithub = () => linkOpener.open("https://github.com/Zagrios/bs-manager");
  const openTwitter = () => linkOpener.open("https://twitter.com/BSManager_");
  const openSupportPage = () => linkOpener.open("https://www.patreon.com/bsmanager");
  const openDiscord = () => linkOpener.open("https://discord.gg/uSqbHVpKdV");

  const [languageSelected] = useState(i18nService.currentLanguage.split("-")[0]);
  const [changelogData, setChangelogData] = useState<jsonData>({
    title: null,
    body: null,
    version: null
  });

  useEffect(() => {
    fetch(`https://raw.githubusercontent.com/Zagrios/bs-manager/ressources/jsons/Changelog/${languageSelected}.json`)
      .then(response => response.json())
      .then(setChangelogData)
      .catch(console.log);
  }, []);

  return (
    <form className="w-[350px] text-gray-800 dark:text-gray-200 h-[70vh] flex flex-col">
      <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{changelogData.title}</h1>
      <BsmImage className="mx-auto h-20" image={BeatRunning} />
      <div className="overflow-y-scroll h-80 content grow" dangerouslySetInnerHTML={{ __html: changelogData.body }}/>
      <span className="block w-[60%] mx-auto my-[16px] h-[2px] rounded-full bg-main-color-2" />
      <div className=" flex flex-row justify-between">
        <div className="flex gap-1">
          <BsmButton onClick={openGithub} className=" rounded-md h-6 p-1 bg-transparent" icon="github" withBar={false}/>
          <BsmButton onClick={openTwitter} className=" rounded-md h-6 p-1" icon="twitter" withBar={false}/>
          <BsmButton onClick={openSupportPage} className=" rounded-md h-6 p-1" icon="patreon" withBar={false}/>
          <BsmButton onClick={openDiscord} className=" rounded-md h-6 p-[5px]" icon="discord" withBar={false}/>
        </div>
        <span><i>{changelogData.version}</i></span>    
      </div>
    </form>
  )
}   