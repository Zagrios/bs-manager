import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { ChangelogVersion } from "renderer/services/auto-updater.service";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { ModalComponent } from "renderer/services/modale.service";
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
      <form className="w-[350px] text-gray-800 dark:text-gray-200 h-[70vh] flex flex-col justify-between">
        <h1 className=" p-4 pt-1 text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200 font-bold">{changelog?.title}</h1>
        <div className=" overflow-y-scroll h-full content grow" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(changelog?.htmlBody) }}/>
        <span className="block w-[100%] mx-auto mt-0 mb-4 h-1 rounded-full bg-main-color-1" />
        <div className="flex flex-row justify-between">
            <div className="my-auto flex flex-col text-sm">
                <span>{formattedTimestamp}</span>
                <span >v{changelog?.version}</span>
            </div>
            <div className="flex flex-row gap-2 my-auto">
                <BsmButton onClick={openTwitter} className="rounded-md p-1 w-7 h-7" icon="twitter" withBar={false} color="#1DA1F2" iconColor="#FFFFFF"/>
                <BsmButton onClick={openGithub} className="rounded-md p-1 w-7 h-7" icon="github" withBar={false} color="#000000" iconColor="#FFFFFF"/>
                <BsmButton onClick={openDiscord} className="rounded-md p-1 w-7 h-7" icon="discord" withBar={false} color="#5865F2" iconColor="#FFFFFF"/>
                <BsmButton onClick={openSupportPage} className="rounded-md p-1 w-7 h-7" icon="patreon" withBar={false} color="#FF424D" iconColor="#FFFFFF"/>
            </div>
        </div>
      </form>
    )
  }
