import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ModalComponent } from "renderer/services/modale.service";
import BeatRunning from '../../../../../../assets/images/apngs/beat-running.png';
import "./changelog-modal.component.css"
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { LinkOpenerService } from "renderer/services/link-opener.service";

type ChangelogData = {
  title: string,
  body: string,
  version: string
}

export const ChangelogModal: ModalComponent<void, ChangelogData> = ({ resolver, changelog }) => {

  const linkOpener: LinkOpenerService = LinkOpenerService.getInstance();
  const openGithub = () => linkOpener.open("https://github.com/Zagrios/bs-manager");
  const openTwitter = () => linkOpener.open("https://twitter.com/BSManager_");
  const openSupportPage = () => linkOpener.open("https://www.patreon.com/bsmanager");
  const openDiscord = () => linkOpener.open("https://discord.gg/uSqbHVpKdV");

  return (
    <form className="w-[350px] text-gray-800 dark:text-gray-200 h-[70vh] flex flex-col">
      <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{changelog?.title}</h1>
      <BsmImage className="mx-auto h-20" image={BeatRunning} />
      <div className="relative h-80 ">
        <div className=" absolute overflow-y-scroll h-full content grow" dangerouslySetInnerHTML={{ __html: changelog?.body }}/>
      </div>
      <span className="block w-[60%] mx-auto my-[16px] h-[2px] rounded-full bg-main-color-2" />
      <div className=" flex flex-row justify-between">
        <div className="flex gap-1">
          <BsmButton onClick={openGithub} className=" rounded-md h-6 p-1 bg-transparent" icon="github" withBar={false}/>
          <BsmButton onClick={openTwitter} className=" rounded-md h-6 p-1" icon="twitter" withBar={false}/>
          <BsmButton onClick={openSupportPage} className=" rounded-md h-6 p-1" icon="patreon" withBar={false}/>
          <BsmButton onClick={openDiscord} className=" rounded-md h-6 p-[5px]" icon="discord" withBar={false}/>
        </div>
        <span><i>{changelog?.version}</i></span>
      </div>
    </form>
  )
}
