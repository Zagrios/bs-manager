import { useState, useEffect } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode, ModalService } from "renderer/services/modale.service";
import { WhySteamCredentialsModal } from "./why-steam-credentials-modal.component";
import { useService } from "renderer/hooks/use-service.hook";
import { Observable } from "rxjs";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { QRCodeSVG } from "qrcode.react";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmBasicSpinner } from "renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component";

export const LoginToSteamModal: ModalComponent<
    { username: string; password: string; stay: boolean, method: "form"|"qr" },
    { qrCode$: Observable<string>, logged$: Observable<string> }
> = ({ resolver, options: {data} }) => {

    const modal = useService(ModalService);

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [stay, setStay] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const qrCodeUrl = useObservable(() => data.qrCode$);
    const t = useTranslation();

    useEffect(() => {

        const sub = data.logged$.subscribe({
            next: logged => {
                if(!logged) return;
                // If the logged event is emitted, it means that the user is logged in by the QR code
                resolver({ exitCode: ModalExitCode.COMPLETED, data: { username, password, stay, method: "qr" } });
            },
            error: () => resolver({ exitCode: ModalExitCode.NO_CHOICE}),
            complete: () => resolver({ exitCode: ModalExitCode.NO_CHOICE})
        });

        return () => sub.unsubscribe();
    }, []);

    const loggin = () => {
        if (!username || !password) {
            return;
        }
        resolver({ exitCode: ModalExitCode.COMPLETED, data: { username, password, stay, method: "form" } });
    };

    const whyCredentials = () => {
        modal.openModal(WhySteamCredentialsModal);
    };

    return (
        <form className="w-[40rem] text-gray-800 dark:text-gray-200" onSubmit={e => {e.preventDefault(); loggin()}}>
            <h1 className="text-3xl uppercase tracking-wide w-full text-center mb-5">{t("modals.steam-login.title")}</h1>
            <div className="flex justify-center items-stretch gap-5 min-w-0">
                <div className="grow flex flex-col gap-2">
                    <div>
                        <label className="block font-bold cursor-pointer tracking-wide" htmlFor="username">
                            {t("modals.steam-login.inputs.username.label")}
                        </label>
                        <input className="w-full bg-light-main-color-1 dark:bg-main-color-1 px-1 py-0.5 rounded-md outline-none h-9" onChange={e => setUsername(e.target.value)} value={username} type="text" name="username" id="username" placeholder={t("modals.steam-login.inputs.username.placeholder")} />
                    </div>
                    <div>
                        <label className="block font-bold cursor-pointer tracking-wide" htmlFor="password">
                            {t("modals.steam-login.inputs.password.label")}
                        </label>
                        <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md flex box-border h-9">
                            <input className="grow px-1 py-0.5 outline-none bg-transparent" onChange={e => setPassword(e.target.value)} value={password} type={showPassword ? "text" : "password"} name="password" id="password" placeholder={t("modals.steam-login.inputs.password.placeholder")} />
                            <BsmButton className="shrink-0 m-1 rounded-md p-0.5 !bg-light-main-color-3 dark:!bg-main-color-3" icon={showPassword ? "eye-cross" : "eye"} withBar={false} onClick={() => setShowPassword(prev => !prev)} />
                        </div>
                        {password?.length > 64 && <span className="text-orange-700 dark:text-orange-400 text-xs whitespace-normal min-w-0">{t("modals.steam-login.inputs.password.max-length-warning")}</span>}
                    </div>
                    <div className="flex flex-row justify-start items-center gap-1.5 py-3">
                        <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={stay} onChange={enable => setStay(() => enable)}/>
                        <span>{t("modals.steam-login.inputs.stay")}</span>
                    </div>
                    <BsmButton typeColor="primary" className="rounded-md text-center transition-all h-10" type="submit" withBar={false} text="modals.steam-login.buttons.submit" />
                    <div className="grow flex justify-center items-center gap-1 flex-col">
                        <a className="flex justify-center items-center text-[.85rem] underline" href="https://help.steampowered.com/wizard/HelpWithLogin" target="_blank">{t("modals.steam-login.need-help-to-connect")}</a>
                        <span className="flex justify-center items-center text-[.85rem] underline cursor-pointer" onClick={whyCredentials}>{t("modals.steam-login.why-credentials")}</span>
                    </div>
                </div>
                <div className="flex flex-col max-w-[13rem]">
                    <span className="block font-bold cursor-pointer tracking-wide ">{t("modals.steam-login.inputs.qr.label")}</span>
                    <div className="w-52 h-52 p-3 bg-light-main-color-1 dark:bg-white rounded-md max-w-xs mb-1 flex items-center justify-center">
                        {(qrCodeUrl ?
                            <QRCodeSVG className="w-full h-full text-light-main-color-1 dark:text-white" value={qrCodeUrl} bgColor="currentColor" level="H"/> :
                            <BsmBasicSpinner className="w-full h-full p-11 text-neutral-300" />
                        )}
                    </div>
                    <span className="text-center whitespace-break-spaces text-[.85rem]">
                    {t("modals.steam-login.inputs.qr.note.use-the")}<a className="underline" href="https://store.steampowered.com/mobile" target="_blank">{t("modals.steam-login.inputs.qr.note.steam-mobile-app")}</a> {t("modals.steam-login.inputs.qr.note.to-connect-with-qr")}
                    </span>
                </div>
            </div>
        </form>
    );
};
