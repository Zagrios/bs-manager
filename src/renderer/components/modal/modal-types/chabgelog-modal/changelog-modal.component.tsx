import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { ChangelogVersion } from "renderer/services/auto-updater.service";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { ModalComponent } from "renderer/services/modale.service";
import BeatRunning from "../../../../../../assets/images/apngs/beat-running.png";
import DOMPurify from 'dompurify';
import './changelog-modal.component.css';

export const ChangelogModal: ModalComponent<void, ChangelogVersion> = ({ resolver, data: changelog }) => {

    const linkOpener: LinkOpenerService = LinkOpenerService.getInstance();
    const openGithub = () => linkOpener.open("https://github.com/Zagrios/bs-manager");
    const openTwitter = () => linkOpener.open("https://twitter.com/BSManager_");
    const openSupportPage = () => linkOpener.open("https://www.patreon.com/bsmanager");
    const openDiscord = () => linkOpener.open("https://discord.gg/uSqbHVpKdV");
    const formattedTimestamp = changelog?.timestampPublished ? new Date(changelog.timestampPublished * 1000).toLocaleDateString() : '';

    return (
      <form className="w-[350px] text-gray-800 dark:text-gray-200 h-[70vh] flex flex-col">
        <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{changelog?.title}</h1>
        <BsmImage className="mx-auto h-20" image={BeatRunning} />
        <div className="relative h-80 ">
          <div className=" absolute overflow-y-scroll h-full content grow" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(changelog?.htmlBody) }}/>
        </div>
        <span className="block w-[95%] mx-auto my-[16px] h-[3px] rounded-full bg-main-color-1" />
        <div className=" flex flex-row justify-between">
          <span><i>{formattedTimestamp}</i></span>
          <span><i>{changelog?.version}</i></span>
        </div>
        <div className="flex gap-2 mt-1 justify-end h-7">
          <BsmButton onClick={openTwitter} className="rounded-md p-1" icon="twitter" withBar={false} color="#1DA1F2" iconColor="#FFFFFF"/>
          <BsmButton onClick={openGithub} className="rounded-md p-1" icon="github" withBar={false} color="#000000" iconColor="#FFFFFF"/>
          <BsmButton onClick={openDiscord} className="rounded-md p-1" icon="discord" withBar={false} color="#5865F2" iconColor="#FFFFFF"/>
          <BsmButton onClick={openSupportPage} className="rounded-md p-1" icon="patreon" withBar={false} color="#FF424D" iconColor="#FFFFFF"/>
        </div>
      </form>
    )
  }
