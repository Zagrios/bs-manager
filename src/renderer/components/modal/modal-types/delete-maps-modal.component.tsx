import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import BeatConflict from '../../../../../assets/images/apngs/beat-conflict.png'

export const DeleteMapsModal: ModalComponent<void, {linked: boolean, maps: BsmLocalMap[]}> = ({resolver, data:{linked, maps}}) => {

    const t = useTranslation();

    const multiple = maps.length > 1;

    const titleText = multiple ? "Supprimer les maps" : "Supprimer la map";
    const descText = multiple ? `Est-tu sur de vouloir supprimer les ${maps.length} maps ?` : `Est-tu sur de vouloir supprimer la map ${maps.at(0).rawInfo._songName} ?`;
    const linkDescText = multiple ? "Ces maps font parties des maps partagées" : "Cette map fait partie des maps paratagées";

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{titleText}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">{descText}</p>
            {linked && <p className="max-w-sm w-full text-sm italic mt-2">{linkDescText}</p>}
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.CANCELED})} withBar={false} text="misc.cancel"/>
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.COMPLETED})} withBar={false} text="Supprimer"/>
            </div>
        </form>
    )
}