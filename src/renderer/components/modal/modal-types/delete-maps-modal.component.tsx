import { useEffect, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { MapsManagerService } from "renderer/services/maps-manager.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import BeatConflict from '../../../../../assets/images/apngs/beat-conflict.png'

export const DeleteMapsModal: ModalComponent<void, {linked: boolean, maps: BsmLocalMap[]}> = ({resolver, data:{linked, maps}}) => {

    const config = ConfigurationService.getInstance();

    const t = useTranslation();

    const [remember, setRemember] = useState(false);

    useEffect(() => {
        const key = MapsManagerService.REMEMBER_CHOICE_DELETE_MAP_KEY;
        config.set(key, remember);
    }, [remember])
    

    const multiple = maps.length > 1;

    const titleText = multiple ? "modals.maps-actions.delete-maps.title.multiple" : "modals.maps-actions.delete-maps.title.single";
    const descText = multiple ? "modals.maps-actions.delete-maps.desc.multiple" : "modals.maps-actions.delete-maps.desc.single";
    const infoText = multiple ? "modals.maps-actions.delete-maps.info.desc.multiple" : "modals.maps-actions.delete-maps.info.desc.single";
    const infoTitleText = multiple ? "modals.maps-actions.delete-maps.info.title.multiple" : "modals.maps-actions.delete-maps.info.title.single";

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t(titleText)}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">{t(descText, multiple ? {nb: maps.length.toString()} : {name: maps.at(0).rawInfo._songName})}</p>
            {linked && <p className="text-sm italic mt-2 cursor-help w-fit" title={t(infoTitleText)}>{t(infoText)}</p>}
            {!multiple && (
                <div className="flex items-center relative py-2 gap-1 mt-1">
                    <BsmCheckbox className="h-5 relative z-[1]" checked={remember} onChange={(val) => setRemember(val)}/>
                    <span className="italic">{t("modals.misc.remember-my-choice")}</span>
                </div>
            )}
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.CANCELED})} withBar={false} text="misc.cancel"/>
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.COMPLETED})} withBar={false} text="misc.delete"/>
            </div>
        </form>
    )
}