import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatImpatient from "../../../../../assets/images/apngs/beat-impatient.png";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import Tippy from "@tippyjs/react";
import { useState } from "react";
import { BsStore } from "shared/models/bs-store.enum";

export const ImportVersionModal: ModalComponent<BsStore> = ({ resolver }) => {
    
    const t = useTranslation();
    const [isOculus, setIsOculus] = useState(false);

    const submit = () => {
        resolver({ exitCode: ModalExitCode.COMPLETED, data: isOculus ? BsStore.OCULUS : BsStore.STEAM });
    }

    return (
        <form>
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.bs-import-version.title")}</h1>
            <BsmImage className="mx-auto h-20" image={BeatImpatient} />
            <p className="max-w-sm text-gray-800 dark:text-gray-200">{t("modals.bs-import-version.description")}</p>
            <Tippy content={t("modals.bs-import-version.oculus-version-tooltip")} placement="right" arrow={false} className="!bg-neutral-900 font-bold">
                <div className="relative flex flex-row items-center gap-1.5 mb-4 mt-3 cursor-help w-fit">
                    <BsmCheckbox className="relative h-5 w-5 z-[1]" checked={isOculus} onChange={checked => setIsOculus(checked)}/>
                    <span className="font-bold italic">{t("modals.bs-import-version.oculus-version")}</span>
                </div>
            </Tippy>
            <div className="grid grid-flow-col grid-cols-2 gap-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={submit} withBar={false} text="modals.bs-import-version.buttons.submit" />
            </div>
        </form>
    );
};
