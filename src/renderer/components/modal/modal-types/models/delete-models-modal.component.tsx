import { useState } from "react";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import BeatConflict from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmCheckbox } from "renderer/components/shared/bsm-checkbox.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { useService } from "renderer/hooks/use-service.hook";

export const DeleteModelsModal: ModalComponent<void, { models: BsmLocalModel[]; linked: boolean }> = ({ resolver, options: {data} }) => {
    const config = useService(ConfigurationService);
    const t = useTranslation();
    const [remember, setRemember] = useState(config.get<boolean>(ModelsManagerService.REMEMBER_CHOICE_DELETE_MODEL_KEY) || false);

    useOnUpdate(() => {
        config.set(ModelsManagerService.REMEMBER_CHOICE_DELETE_MODEL_KEY, remember);
    }, [remember]);

    const isMultiple = data.models.length > 1;

    const title = useConstant(() => (isMultiple ? t("models.modals.delete-models.title") : t("models.modals.delete-model.title")));
    const desc = useConstant(() => (isMultiple ? t("models.modals.delete-models.desc", { nb: `${data.models.length}` }) : t("models.modals.delete-model.desc", { modelName: data.models[0]?.model?.name ?? data.models[0]?.fileName })));
    const linkedAnnotation = useConstant(() =>
        (() => {
            if (!data.linked) return null;
            if (isMultiple) return t("models.modals.delete-models.linked-annotation");
            return t("models.modals.delete-model.linked-annotation");
        })()
    );

    return (
        <form className="text-gray-800 dark:text-gray-200">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center">{title}</h1>
            <BsmImage className="mx-auto h-24" image={BeatConflict} />
            <p className="max-w-sm w-full">{desc}</p>
            {data.linked && <p className="text-sm italic mt-2 w-fit">{linkedAnnotation}</p>}
            {!isMultiple && (
                <div className="flex items-center relative py-2 gap-1 mt-1">
                    <BsmCheckbox className="h-5 relative z-[1]" checked={remember} onChange={val => setRemember(val)} />
                    <span className="italic">{t("modals.misc.remember-my-choice")}</span>
                </div>
            )}
            <div className="grid grid-flow-col grid-cols-2 gap-4 mt-2">
                <BsmButton typeColor="cancel" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.CANCELED })} withBar={false} text="misc.cancel" />
                <BsmButton typeColor="primary" className="rounded-md text-center transition-all" onClick={() => resolver({ exitCode: ModalExitCode.COMPLETED })} withBar={false} text="misc.delete" />
            </div>
        </form>
    );
};
