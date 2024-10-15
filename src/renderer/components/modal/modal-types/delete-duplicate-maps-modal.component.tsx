import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import BeatConflict from "../../../../../assets/images/apngs/beat-conflict.png";
import { useConstant } from "renderer/hooks/use-constant.hook";

export const DeleteDuplicateMapsModal: ModalComponent<void, { maps: BsmLocalMap[] }> = ({ resolver, options: {data : { maps }}}) => {

    const t = useTranslation();
    const multiple = useConstant(() => maps.length > 1);

    return (
        <form className="text-gray-800 dark:text-gray-200 max-w-sm">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{t("modals.maps-actions.delete-duplicate-maps.title")}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p>{
                multiple
                    ? t("modals.maps-actions.delete-duplicate-maps.desc-plural", { nb: `${maps.length}` })
                    : t("modals.maps-actions.delete-duplicate-maps.desc", { map: `${maps.at(0).mapInfo.songName}` })
            }</p>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4 h-8">
                <BsmButton typeColor="cancel" className="rounded-md flex justify-center items-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md flex justify-center items-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="misc.delete" />
            </div>
        </form>
    );
};
