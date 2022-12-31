import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatConflict from '../../../../../assets/images/apngs/beat-conflict.png'

export const UnlinkMapsModal: ModalComponent<boolean> = ({resolver}) => {

    const t = useTranslation();
    const [keepMaps, setKeepMaps] = useState(true);

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.maps-actions.unlink-maps.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">{t("modals.maps-actions.unlink-maps.desc")}</p>
            <div className="relative h-5 flex my-3 items-center">
                <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1.5 z-[1]" checked={keepMaps} onChange={setKeepMaps}/>
                <span className="text-sm mb-0.5 cursor-help" title={t("modals.maps-actions.unlink-maps.keep-maps.title")}>{t("modals.maps-actions.unlink-maps.keep-maps.label")}</span>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.CANCELED})} withBar={false} text="misc.cancel"/>
                <BsmButton typeColor="error" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.COMPLETED, data: keepMaps})} withBar={false} text="modals.maps-actions.unlink-maps.valid-btn"/>
            </div>
        </form>
    )
}