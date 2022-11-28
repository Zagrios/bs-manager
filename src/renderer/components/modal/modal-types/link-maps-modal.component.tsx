import { useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import BeatRunning from '../../../../../assets/images/apngs/beat-running.png'

export const LinkMapsModal: ModalComponent<boolean> = ({resolver}) => {

    const t = useTranslation();
    const [keepMaps, setKeepMaps] = useState(true);


    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">Lier les maps</h1>
            <BsmImage className="mx-auto h-24" image={BeatRunning} />
            <p className="max-w-sm w-full">La liaison des maps permet de partager les maps entre toute les version. Lier cette version permettra l'utilisation des maps partager</p>
            <p className="max-w-sm w-full text-sm italic">L'ajout et la suppression de maps sera également partagés</p>
            <div className="relative h-5 flex my-3 items-center">
                <BsmCheckbox className="h-full aspect-square relative bg-inherit mr-1.5 z-[1]" checked={keepMaps} onChange={setKeepMaps}/>
                <span className="text-sm mb-0.5 cursor-help" title="Conserver les maps déplacera les maps de la version actuelle dans le dossier des maps partagées. Dans le cas contraire elles seront perdues">Conserver les maps</span>
            </div>
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-4">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.CANCELED})} withBar={false} text="misc.cancel"/>
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({exitCode: ModalExitCode.COMPLETED, data: keepMaps})} withBar={false} text="Lier les maps"/>
            </div>
        </form>
    )
}