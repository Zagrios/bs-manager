import { useState } from 'react'
import { ModalComponent, ModalExitCode } from 'renderer/services/modale.service'
import { BsmLocalModel } from 'shared/models/models/bsm-local-model.interface'
import BeatConflict from '../../../../../../assets/images/apngs/beat-conflict.png'
import { BsmImage } from 'renderer/components/shared/bsm-image.component'
import { BsmCheckbox } from 'renderer/components/shared/bsm-checkbox.component'
import { BsmButton } from 'renderer/components/shared/bsm-button.component'
import { useTranslation } from 'renderer/hooks/use-translation.hook'
import { useOnUpdate } from 'renderer/hooks/use-on-update.hook'
import { useConstant } from 'renderer/hooks/use-constant.hook'
import { ConfigurationService } from 'renderer/services/configuration.service'
import { ModelsManagerService } from 'renderer/services/models-management/models-manager.service'

export const DeleteModelsModal: ModalComponent<void, {models: BsmLocalModel[], linked: boolean}> = ({resolver, data}) => {

    const config = useConstant(() => ConfigurationService.getInstance());
    const t = useTranslation();
    const [remember, setRemember] = useState(false);

    useOnUpdate(() => {
        config.set(ModelsManagerService.REMEMBER_CHOICE_DELETE_MODEL_KEY, remember);
    }, [remember]);

    const isMultiple = data.models.length > 1;

    return (
        // TODO TRANSLATIONS
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{isMultiple ? "Supprimer les modèles" : "Supprimer le modèle"}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict}/>
            <p className="max-w-sm w-full">{isMultiple ? `Es-tu sur de vouloir supprimer les ${data.models.length} modèles ?` : `Es-tu sur de vouloir supprimer le modèle ${data.models[0].model?.name ?? data.models[0].fileName}`}</p>
            {data.linked && <p className="text-sm italic mt-2 cursor-help w-fit" title="TODO TITLE">{isMultiple ? "Ces modèles seront égalements supprimées des versions utilisant les maps partagées" : "Ce modèle sera également supprimée des versions utilisant les maps partagées"}</p>}
            {!isMultiple && (
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
