import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service"

export const WhyCredentialsModal: ModalComponent<void> = ({resolver}) => {

    const t = useTranslation();
    const linkOpener = LinkOpenerService.getInstance();

    const openTutorial = () => {
        linkOpener.open("https://steamcommunity.com/sharedfiles/filedetails/?id=1805934840");
    }

    return (
        <form className="w-min">
            <h1 className="text-3xl mb-2 uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.steam-credentials.title")}</h1>
            
            <p>{t("modals.steam-credentials.p-1")}</p>
            <a onClick={e => {e.preventDefault; openTutorial()}} className="underline text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-600 mb-2 block cursor-pointer">
                https://steamcommunity.com/sharedfiles/filedetails/?id=1805934840
            </a>
            <p>{t("modals.steam-credentials.p-2")}</p>
        </form>
    )
}
