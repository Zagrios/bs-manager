import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { ChangelogVersion } from "renderer/services/auto-updater.service";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { useService } from "renderer/hooks/use-service.hook";
import { ModalComponent } from "renderer/services/modale.service";
import DOMPurify from 'dompurify';
import './changelog-modal.component.css';
import Tippy from "@tippyjs/react";

export const ChangelogModal: ModalComponent<void, ChangelogVersion> = ({ options: {data: changelog} }) => {

    const linkOpener = useService(LinkOpenerService);
    const openGithub = () => linkOpener.open("https://github.com/Zagrios/bs-manager");
    const openTwitter = () => linkOpener.open("https://twitter.com/BSManager_");
    const openSupportPage = () => linkOpener.open("https://www.patreon.com/bsmanager");
    const openDiscord = () => linkOpener.open("https://discord.gg/uSqbHVpKdV");
    const date = changelog?.timestamp  ? new Date(changelog.timestamp  * 1000).toLocaleDateString() : '';

    return (
        <form className="w-[350px] text-gray-800 dark:text-gray-200 h-[70vh] flex flex-col justify-between">
            <h1 className=" p-4 pt-1 text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200 font-bold">{changelog?.title}</h1>
            <div className=" overflow-y-scroll h-full content grow" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(changelog?.htmlBody) }}/>
            <span className="block w-[100%] mx-auto mt-0 mb-4 h-1 rounded-full bg-main-color-1" />
            <div className="flex flex-row justify-between">
                <div className="my-auto flex flex-col text-sm">
                    <span>{date}</span>
                    <span>v{changelog?.version}</span>
                </div>
                <div className="flex flex-row gap-2 my-auto">
                    <Tippy content="Twitter" placement="top" className="font-bold !bg-neutral-900" duration={[200, 0]} arrow={false}>
                        <div><BsmButton onClick={openTwitter} className="rounded-md p-1 w-7 h-7" icon="twitter" withBar={false}  iconColor="#fff" color="#000"/></div>
                    </Tippy>
                    <Tippy content="Github" placement="top" className="font-bold !bg-neutral-900" duration={[200, 0]} arrow={false}>
                        <div><BsmButton onClick={openGithub} className="rounded-md p-1 w-7 h-7" icon="github" withBar={false}  iconColor="#fff" color="#000"/></div>
                    </Tippy>
                    <Tippy content="Discord" placement="top" className="font-bold !bg-neutral-900" duration={[200, 0]} arrow={false}>
                        <div><BsmButton onClick={openDiscord} className="rounded-md p-1 w-7 h-7" icon="discord" withBar={false} iconColor="#fff" color="#000"/></div>
                    </Tippy>
                    <Tippy content="Patreon" placement="top" className="font-bold !bg-neutral-900" duration={[200, 0]} arrow={false}>
                        <div><BsmButton onClick={openSupportPage} className="rounded-md p-1 w-7 h-7 " icon="patreon" withBar={false} iconColor="#fff" color="#000"/></div>
                    </Tippy>
                </div>
            </div>
        </form>
    )
}
