import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalComponent } from "renderer/services/modale.service";
import BeatRunning from '../../../../../../assets/images/apngs/beat-running.png';
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { useEffect, useState } from "react";
import { I18nService } from "renderer/services/i18n.service";
import "./changelog-modal.component.css"

const i18nService: I18nService = I18nService.getInstance();
  type jsonData = {
    title: string,
    body: string,
    version: string
  }

export const ChangelogModal: ModalComponent<void, void> = () => {

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
      <div className="mt-1 flex flex-row justify-between">
        <div className="flex gap-2">
          <BsmIcon icon='github' className='text-blue-500 h-6' style={{ color: "black" }} />
          <BsmIcon icon='twitter' className='text-blue-500 h-6 ' style={{ color: "#00acee" }} />
          <BsmIcon icon='patreon' className='text-blue-500 h-6 ' style={{ color: "#f96854" }} />
          <BsmIcon icon='discord' className='text-blue-500 h-5 ' style={{ color: "#7289d9" }} />
        </div>
        <span>{changelogData.version}</span>    
      </div>
    </form>
  )
}