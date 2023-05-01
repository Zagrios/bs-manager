import { useInView } from "framer-motion";
import { BSVersion } from "shared/bs-version.interface";
import { MutableRefObject, useRef, useState } from "react";
import { MSModelType } from "shared/models/models/model-saber.model";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { useSwitchableObservable } from "renderer/hooks/use-switchable-observable.hook";
import { Progression } from "main/helpers/fs.helpers";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ModelItem } from "./model-item.component";

type Props = {
    className?: string,
    version?: BSVersion,
    type: MSModelType
}

export function ModelsGrid({className, version, type}: Props) {

    const modelsManager = useConstant(() => ModelsManagerService.getInstance());

    const ref = useRef();
    const isVisible = useInView(ref, {once: true, amount: .1});

    const [models, setModelsLoadObservable] = useSwitchableObservable<Progression<BsmLocalModel[]>>();

    console.log(models);

    useOnUpdate(() => {
        
        if(!isVisible){ return; }

        setModelsLoadObservable(() => modelsManager.$getModels(type, version));

    }, [version, isVisible, type]);

    return (
        <div ref={ref} className={`w-full h-full flex-shrink-0 ${className ?? ""}`}>
            {!models || !models?.extra ? (
                <>loading</>
            ) : !models?.extra.length ? (
                <>no models</>
            ) : (
                <ul className="flex w-full h-full overflow-scroll p-4 gap-4">
                    {models.extra.map(localModel => (
                        <ModelItem 
                            key={localModel.model?.hash ?? localModel.hash}
                            modelHash={localModel.model?.hash ?? localModel.hash}
                            modelId={localModel.model?.id}
                            modelType={localModel.type}
                            modelName={localModel.model?.name ?? localModel.fileName}
                            modelImage={localModel.model?.thumbnail}
                            modelAuthor={localModel.model?.author}
                            modelTags={localModel.model?.tags}
                            selected={false}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}
