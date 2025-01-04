import { ModalComponent, ModalExitCode, ModalService } from "../../../../services/modale.service";
import { MouseEventHandler, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslationV2 } from "renderer/hooks/use-translation.hook";
import { MetaIcon } from "renderer/components/svgs/icons/meta-icon.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import Tippy from "@tippyjs/react";
import { useService } from "renderer/hooks/use-service.hook";
import { IpcService } from "renderer/services/ipc.service";
import { lastValueFrom } from "rxjs";
import { EnterMetaTokenModal } from "./enter-meta-token-modal.component";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { MetaAuthErrorCodes } from "shared/models/bs-version-download/oculus-download.model";
import { NotificationService } from "renderer/services/notification.service";

export const LoginToMetaModal: ModalComponent<string> = ({ resolver }) => {

    const { text: t } = useTranslationV2();

    const ipc = useService(IpcService);
    const modal = useService(ModalService);
    const notifications = useService(NotificationService);

    const [stay, setStay] = useState(true);
    const [authWindowOpen, setAuthWindowOpen] = useState(false);

    const handleLoginWithMeta = () => {
        setAuthWindowOpen(() => true);
        lastValueFrom(ipc.sendV2("login-with-meta", stay)).then(token => {
            resolver({ exitCode: ModalExitCode.COMPLETED, data: token });
        }).catch((e: CustomError) => {
            if(e.code === MetaAuthErrorCodes.META_LOGIN_WINDOW_CLOSED_BY_USER){
                return;
            }

            if(e.code){
                notifications.notifyError({title: "notifications.types.error", desc: `notifications.bs-download.oculus-download.errors.msg.${e.code}`});
            }

            resolver({ exitCode: ModalExitCode.CANCELED });
        }).finally(() => {
            setAuthWindowOpen(() => false);
        })
    }

    const handleEnterTokenManually: MouseEventHandler<HTMLButtonElement> = async (e) => {
        e.preventDefault();
        const res = await modal.openModal(EnterMetaTokenModal);
        resolver(res);
    }

    return (
        <form className="flex flex-col justify-center items-center w-96 gap-4">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.connect-to-meta.title")}</h1>

            <div className="flex justify-center items-center h-28 aspect-square bg-white rounded-full p-4">
                <MetaIcon className="w-full h-full"/>
            </div>

            <p className="font-bold">{t("modals.connect-to-meta.body.token-needed")}</p>
            <p>{t("modals.connect-to-meta.body.need-cookie-enabled")}</p>

            <div className="w-full flex flex-row justify-start items-center gap-1.5">
                <BsmCheckbox className="relative z-[1] w-6 aspect-square" checked={stay} onChange={enable => setStay(() => enable)}/>
                <span>{t("modals.connect-to-meta.stay")}</span>
            </div>

            <BsmButton className="rounded-md flex justify-center items-center transition-all h-10 w-full" typeColor="primary" text="modals.connect-to-meta.connect-to-meta" withBar={false} onClick={handleLoginWithMeta} disabled={authWindowOpen}/>

            <Tippy className="!bg-neutral-900" arrow={false} content={t("modals.connect-to-meta.body.enter-token-manually-tooltip")} >
                <button className="text-sm italic underline text-center -translate-y-1 leading-3 cursor-pointer" onClick={handleEnterTokenManually}>{t("modals.connect-to-meta.body.enter-token-manually")}</button>
            </Tippy>

        </form>
    );
};
