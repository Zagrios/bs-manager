import { useService } from "renderer/hooks/use-service.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { LinkOpenerService } from "renderer/services/link-opener.service";
import { ModalComponent } from "renderer/services/modale.service";

export const WhySteamCredentialsModal: ModalComponent<void> = () => {
    const t = useTranslation();
    const linkOpener = useService(LinkOpenerService);

    const openTutorial = () => {
        linkOpener.open("https://steamcommunity.com/sharedfiles/filedetails/?id=1805934840");
    };

    return (
        <form className="w-min">
            <h1 className="text-3xl mb-2 uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.steam-credentials.title")}</h1>

            <p>{t("modals.steam-credentials.p-1")}</p>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a
                onClick={e => {
                    e.preventDefault();
                    openTutorial();
                }}
                className="underline text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-600 mb-2 block cursor-pointer"
            >
                https://steamcommunity.com/sharedfiles/filedetails/?id=1805934840
            </a>
            <p>{t("modals.steam-credentials.p-2")}</p>
        </form>
    );
};
