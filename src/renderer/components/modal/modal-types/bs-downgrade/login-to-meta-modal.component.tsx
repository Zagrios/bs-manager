import { ModalComponent, ModalExitCode } from "../../../../services/modale.service";
import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { MetaIcon } from "renderer/components/svgs/icons/meta-icon.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import Tippy from "@tippyjs/react";

type ReturnType = { method: MetaAuthMethod.META, stay: boolean } | { method: MetaAuthMethod.MANUAL };

export const LoginToMetaModal: ModalComponent<ReturnType> = ({ resolver }) => {

    const t = useTranslation();

    const [stay, setStay] = useState(false);

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: { method: MetaAuthMethod.META, stay } });
    };

    const enterTokenManually = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: { method: MetaAuthMethod.MANUAL } });
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

            <BsmButton className="rounded-md flex justify-center items-center transition-all h-10 w-full" typeColor="primary" text="modals.connect-to-meta.connect-to-meta" withBar={false} onClick={submit}/>

            <Tippy className="!bg-neutral-900" arrow={false} content={t("modals.connect-to-meta.body.enter-token-manually-tooltip")} >
                <p className="text-sm italic underline text-center -translate-y-1 leading-3 cursor-pointer" onClick={enterTokenManually}>{t("modals.connect-to-meta.body.enter-token-manually")}</p>
            </Tippy>
            
        </form>
    );
};

export enum MetaAuthMethod {
    MANUAL = "manual",
    META = "meta"
}
