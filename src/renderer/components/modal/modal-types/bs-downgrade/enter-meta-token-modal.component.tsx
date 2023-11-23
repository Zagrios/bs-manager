import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import BeatWaiting from "../../../../../../assets/images/apngs/beat-impatient.png";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useState } from "react";
import { isOculusTokenValid } from "shared/helpers/oculus.helpers";
import { logRenderError } from "renderer";

export const EnterMetaTokenModal: ModalComponent<string> = ({resolver}) => {

    const t = useTranslation();

    const [token, setToken] = useState("");
    const [showToken, setShowToken] = useState(false);

    const submit = () => {
        resolver({exitCode: ModalExitCode.COMPLETED, data: token});
    }

    const cancel = () => {
        resolver({exitCode: ModalExitCode.CANCELED});
    }

    const isTokenValid = (() => {
        return isOculusTokenValid(token, logRenderError);
    })();
    
    return (
        <form className="flex flex-col w-80 gap-4">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.enter-meta-token.title")}</h1>

            <BsmImage className="h-20 w-20 mx-auto" image={BeatWaiting}/>

            <p>{t("modals.enter-meta-token.body.need-token")}</p>

            <a href="https://github.com/Zagrios/bs-manager/wiki/How-to-obtain-your-Oculus-Token" target="_blank" className="underline">{t("modals.enter-meta-token.body.how-obtain-token")}</a>
            
            <div>
                <div className="flex flex-row items-center justify-between">
                    <label className="font-bold cursor-pointer tracking-wide inline-block" htmlFor="meta_token">{t("modals.enter-meta-token.body.input-label")}</label>
                    {!isTokenValid && token.length > 0 && (
                        <span className="text-orange-700 dark:text-orange-400 text-xs whitespace-normal min-w-0">{t("modals.enter-meta-token.body.token-is-invalid")}</span>
                    )}
                </div>
                <div className="bg-light-main-color-1 dark:bg-main-color-1 rounded-md flex box-border h-9">
                    <input className="grow px-1 py-[2px] outline-none bg-transparent" onChange={e => setToken(e.target.value)} value={token} type={showToken ? "text" : "password"} name="meta_token" id="meta_token" placeholder="OCAStr43sdx2..." />
                    <BsmButton className="shrink-0 m-1 rounded-md p-0.5 !bg-light-main-color-3 dark:!bg-main-color-3" icon={showToken ? "eye-cross" : "eye"} withBar={false} onClick={() => setShowToken(prev => !prev)} />
                </div>
            </div>

            <div className="flex flex-row gap-2">
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="cancel" text="misc.cancel" withBar={false} onClick={cancel}/>
                <BsmButton className="rounded-md flex justify-center items-center transition-all h-9 w-full" typeColor="primary" text="modals.enter-meta-token.valid-btn" withBar={false} onClick={submit} disabled={!isTokenValid}/>
            </div>
        
        </form>
    );
}
