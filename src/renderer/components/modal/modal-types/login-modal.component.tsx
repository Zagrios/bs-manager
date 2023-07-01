import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode, ModalService } from "renderer/services/modale.service";
import BeatImpatient from "../../../../../assets/images/apngs/beat-impatient.png";
import { WhyCredentialsModal } from "./why-credentials-modal.component";

export const LoginModal: ModalComponent<{ username: string; password: string; stay: boolean }> = ({ resolver }) => {
    const modal = ModalService.getInsance();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [stay, setStay] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const t = useTranslation();

    const loggin = () => {
        if (!username || !password) {
            return;
        }
        resolver({ exitCode: ModalExitCode.COMPLETED, data: { username, password, stay } });
    };

    const whyCredentials = () => {
        modal.openModal(WhyCredentialsModal);
    };

    return (
        <form
            className="max-w-xs"
            onSubmit={e => {
                e.preventDefault();
                loggin();
            }}
        >
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.steam-login.title")}</h1>
            <BsmImage className="mx-auto h-20" image={BeatImpatient} />

            <div className="mb-2">
                <label className="block font-bold cursor-pointer tracking-wide text-gray-800 dark:text-gray-200" htmlFor="username">
                    {t("modals.steam-login.inputs.username.label")}
                </label>
                <input className="w-full bg-light-main-color-1 dark:bg-main-color-1 px-1 py-[2px] rounded-md outline-none h-8" onChange={e => setUsername(e.target.value)} value={username} type="text" name="username" id="username" placeholder={t("modals.steam-login.inputs.username.placeholder")} />
            </div>
            <div className="mb-2 flex flex-col w-full">
                <label className="block font-bold cursor-pointer tracking-wide text-gray-800 dark:text-gray-200" htmlFor="password">
                    {t("modals.steam-login.inputs.password.label")}
                </label>
                <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md flex box-border h-8">
                    <input className="grow px-1 py-[2px] outline-none bg-transparent" onChange={e => setPassword(e.target.value)} value={password} type={showPassword ? "text" : "password"} name="password" id="password" placeholder={t("modals.steam-login.inputs.password.placeholder")} />
                    <BsmButton className="shrink-0 m-1 rounded-md p-0.5 !bg-light-main-color-3 dark:!bg-main-color-3" icon={showPassword ? "eye-cross" : "eye"} withBar={false} onClick={() => setShowPassword(prev => !prev)} />
                </div>
                {password?.length > 64 && <span className="text-orange-700 dark:text-orange-400 text-xs whitespace-normal max-w-full w-full overflow-hidden">{t("modals.steam-login.inputs.password.max-length-warning")}</span>}
            </div>

            <span onClick={whyCredentials} className="underline my-4 block cursor-pointer">
                {t("modals.steam-login.why-credentials")}
            </span>

            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton
                    typeColor="cancel"
                    className="rounded-md text-center transition-all"
                    onClick={() => {
                        resolver({ exitCode: ModalExitCode.CANCELED });
                    }}
                    withBar={false}
                    text="misc.cancel"
                />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" type="submit" withBar={false} text="modals.steam-login.buttons.submit" />
            </div>
        </form>
    );
};
