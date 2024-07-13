import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import BeatWaiting from "../../../../../../assets/images/apngs/beat-waiting.png";
import LoginMobileAuthImage from "../../../../../../assets/images/steam/login_mobile_auth.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { Observable } from "rxjs";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";

export const SteamMobileApproveModal: ModalComponent<void, { logged$: Observable<unknown> }> = ({ resolver, options: {data} }) => {

    const t = useTranslation();

    useOnUpdate(() => {
        const sub = data.logged$.subscribe({
            next: () => resolver({ exitCode: ModalExitCode.COMPLETED }),
            error: () => resolver({ exitCode: ModalExitCode.NO_CHOICE }),
            complete: () => resolver({ exitCode: ModalExitCode.NO_CHOICE }),
        });

        return () => sub.unsubscribe();
    }, []);

    return (
        <form className="max-w-md flex flex-col items-center">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200 m-0">{t("modals.steam-auth-approve.title")}</h1>

            <p className="font-bold my-3">{t("modals.steam-auth-approve.protected-by-mobile-auth")}</p>

            <div className="relative flex w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-md gap-5">
                <BsmImage className="w-fit ml-7 mt-5" image={LoginMobileAuthImage}/>
                <div className="flex flex-col justify-center gap-5 pr-2">
                    <p className="text-lg">{t("modals.steam-auth-approve.use-steam-app-to-approve")}</p>
                </div>
                <BsmImage className="absolute bottom-1 right-1 w-10 h-10 spin-loading" image={BeatWaiting}/>
            </div>
            <a className="underline text-sm mt-2.5" href="https://help.steampowered.com/wizard/HelpWithLoginInfo?lost=8&issueid=402" target="_blank">{t("modals.steam-auth-approve.not-access-to-steam-app")}</a>
        </form>
    );
};
