import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import BeatWaiting from "../../../../../../assets/images/apngs/beat-impatient.png";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useState } from "react";
import { isOculusTokenValid } from "shared/helpers/oculus.helpers";
import crypto from "crypto-js";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import Tippy from "@tippyjs/react";
import { tryit } from "shared/helpers/error.helpers";
import { logRenderError } from "renderer";
import { useService } from "renderer/hooks/use-service.hook";
import { ConfigurationService } from "renderer/services/configuration.service";

const OCULUS_TOKEN_STORAGE_KEY = "meta-token";

export const EnterMetaTokenModal: ModalComponent<string> = ({resolver}) => {

    const t = useTranslation();

    const config = useService(ConfigurationService);

    const [passwordView, setPasswordView] = useState(() => !!config.get(OCULUS_TOKEN_STORAGE_KEY));

    const submit = (token: string) => {
        resolver({exitCode: ModalExitCode.COMPLETED, data: token});
    }

    const cancel = () => {
        resolver({exitCode: ModalExitCode.CANCELED});
    }

    return (
        <form className="flex flex-col w-80 gap-4">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.enter-meta-token.title")}</h1>
            <BsmImage className="h-20 w-20 mx-auto" image={BeatWaiting}/>
            {passwordView ? (
                <EnterPasswordView onValid={submit} onCancel={cancel} dontHaveToken={() => setPasswordView(() => false)}/>
            ) : (
                <EnterOculusTokenView onValid={submit} onCancel={cancel} alreadyHaveToken={() => setPasswordView(() => true)}/>
            )}
        </form>
    );
}

const EnterPasswordView = ({onValid, onCancel, dontHaveToken}: {onValid: (token: string) => void, onCancel: () => void, dontHaveToken: () => void}) => {

    const t = useTranslation();

    const config = useService(ConfigurationService);

    const [password, setPassword] = useState("");

    const getTokenFromStorage = () => {
        const cryptedToken = config.get<string>(OCULUS_TOKEN_STORAGE_KEY);
        if(!cryptedToken) return null;
        const { result: token, error } = tryit(() => crypto.AES.decrypt(cryptedToken, password).toString(crypto.enc.Utf8));

        if(error){
            logRenderError(error, "Often indicate that the password is not the same as the one used to save the token. This error can occur when the use is writing the password.");
        }

        return token;
    }

    const isTokenValid = () => {
        const token = getTokenFromStorage();
        return isOculusTokenValid(token);
    }

    const valid = () => {
        const token = getTokenFromStorage();
        onValid(token);
    }

    return (
        <>
            <p>{t("modals.enter-meta-token.body.info-enter-password")}</p>

            <div className="flex flex-col gap-2">
                <div>
                    <PasswordInput onChange={v => setPassword(v.password)} value={password}/>
                </div>

                <div>
                    <span className="underline italic text-sm float-right cursor-pointer" onClick={dontHaveToken}>{t("modals.enter-meta-token.body.enter-oculus-token")}</span>
                </div>
            </div>

            <div className="flex flex-row gap-2">
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="cancel" text="misc.cancel" withBar={false} onClick={onCancel}/>
                <Tippy className="!bg-neutral-900" disabled={!password || isTokenValid()} arrow={false} content={t("modals.enter-meta-token.body.info-disabled-btn-password")} hideOnClick={false}>
                    <div className="w-full">
                        <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="primary" text="modals.enter-meta-token.valid-btn" withBar={false} onClick={valid} disabled={!isTokenValid()}/>
                    </div>
                </Tippy>
            </div>
        </>

    );

}

const EnterOculusTokenView = ({onValid, onCancel, alreadyHaveToken}: {onValid: (token: string) => void, onCancel: () => void, alreadyHaveToken: () => void}) => {

    const t = useTranslation();

    const config = useService(ConfigurationService);

    const [token, setToken] = useState("");
    const [showToken, setShowToken] = useState(false);
    const [stay, setStay] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordValid, setPasswordValid] = useState(false);

    const storeToken = (token: string, password: string) => {
        const cryptedToken = crypto.AES.encrypt(token, password).toString();
        config.set(OCULUS_TOKEN_STORAGE_KEY, cryptedToken);
    }

    const valid = () => {

        if(stay){
            storeToken(token, password);
        } else {
            config.delete(OCULUS_TOKEN_STORAGE_KEY);
        }

        onValid(token);
    }

    const isCryptedTokenPresent = () => {
        return !!config.get(OCULUS_TOKEN_STORAGE_KEY);
    }

    return (
        <>
            <p>{t("modals.enter-meta-token.body.info-enter-token")}</p>
            <a href="https://github.com/Zagrios/bs-manager/wiki/How-to-obtain-your-Oculus-Token" target="_blank" className="underline">{t("modals.enter-meta-token.body.how-obtain-token")}</a>

            <div className="flex flex-col gap-2">
                <div>
                    <div className="flex flex-row items-center justify-between">
                        <label className="font-bold cursor-pointer tracking-wide inline-block" htmlFor="meta_token">{t("modals.enter-meta-token.body.oculus-token")}</label>
                        {!isOculusTokenValid(token) && token.length > 0 && (
                            <span className="text-orange-700 dark:text-orange-400 text-xs whitespace-normal min-w-0">{t("modals.enter-meta-token.body.token-is-invalid")}</span>
                        )}
                    </div>
                    <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md flex box-border h-9">
                        <input className="grow px-1 py-[2px] outline-none bg-transparent" onChange={e => setToken(e.target.value)} value={token} type={showToken ? "text" : "password"} name="meta_token" id="meta_token" placeholder="FRLAStr43sdx2..." />
                        <BsmButton className="shrink-0 m-1 rounded-md p-0.5 !bg-light-main-color-3 dark:!bg-main-color-3" icon={showToken ? "eye-cross" : "eye"} withBar={false} onClick={() => setShowToken(prev => !prev)} />
                    </div>
                </div>

                <Tippy className="!bg-neutral-900" arrow={false} content={t("modals.enter-meta-token.body.save-token-info")}>
                    <div className="flex flex-row items-center gap-1 w-fit">
                        <BsmCheckbox className="h-6 w-6 relative z-[1]" onChange={setStay} checked={stay}/>
                        <span className="font-bold cursor-help">{t("modals.enter-meta-token.body.save-my-token")}</span>
                    </div>
                </Tippy>

                <div className="grid grid-rows-[0fr] transition-[grid-template-rows]" style={{gridTemplateRows: stay && "1fr"}}>
                    <div className="overflow-hidden">
                        <PasswordInput onChange={v => {setPassword(v.password); setPasswordValid(v.valid)}} value={password}/>
                    </div>
                </div>

                {isCryptedTokenPresent() && (
                    <div>
                        <span className="underline italic text-sm float-right cursor-pointer" onClick={alreadyHaveToken}>{t("modals.enter-meta-token.body.have-token-saved")}</span>
                    </div>
                )}
            </div>

            <div className="flex flex-row gap-2">
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="cancel" text="misc.cancel" withBar={false} onClick={onCancel}/>
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="primary" text="modals.enter-meta-token.valid-btn" withBar={false} onClick={valid} disabled={!isOculusTokenValid(token) || (stay && !passwordValid)}/>
            </div>
        </>

    );

}

const PasswordInput = ({onChange, value}: {onChange: (value : {password: string, valid: boolean}) => void, value: string}) => {

    const t = useTranslation();

    const [showPassword, setShowPassword] = useState(false);

    const isPasswordValid = (password: string) => {
        return password.length >= 8;
    }

    return (
        <>
            <div className="flex flex-row items-center justify-between">
                <label className="font-bold cursor-pointer tracking-wide inline-block" htmlFor="password">{t("modals.enter-meta-token.body.password")}</label>
                {!isPasswordValid(value) && value.length > 0 && (
                    <span className="text-orange-700 dark:text-orange-400 text-xs whitespace-normal min-w-0">{t("modals.enter-meta-token.body.password-too-short")}</span>
                )}
            </div>
            <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md flex box-border h-9">
                <input className="grow px-1 py-[2px] outline-none bg-transparent" onChange={e => onChange({password: e.target.value, valid: isPasswordValid(e.target.value)})} value={value} type={showPassword ? "text" : "password"} name="password" id="password" placeholder={t("modals.enter-meta-token.body.password")} />
                <BsmButton className="shrink-0 m-1 rounded-md p-0.5 !bg-light-main-color-3 dark:!bg-main-color-3" icon={showPassword ? "eye-cross" : "eye"} withBar={false} onClick={() => setShowPassword(prev => !prev)} />
            </div>
        </>
    )

}
