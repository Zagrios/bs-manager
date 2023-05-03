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

    const isLoading = !models || !models?.extra;
    const hasModels = !isLoading && models?.extra.length;

    console.log(models);

    useOnUpdate(() => {
        
        if(!isVisible){ return; }

        setModelsLoadObservable(() => modelsManager.$getModels(type, version));

    }, [version, isVisible, type]);

    return (
        <div ref={ref} className={`w-full h-full flex-shrink-0 ${className ?? ""}`}>
            {isLoading && <>loading</>}
            {!hasModels && <>no models</>}
            {hasModels && !isLoading && (
                <ul className="flex w-full h-full overflow-scroll p-4 gap-4">
                    {models.extra.map(localModel => (
                        <ModelItem 
                            key={localModel.model?.hash ?? localModel.hash}
                            hash={localModel.model?.hash ?? localModel.hash}
                            id={localModel.model?.id}
                            type={localModel.type}
                            name={localModel.model?.name ?? localModel.fileName}
                            thumbnail={localModel.model?.thumbnail}
                            author={localModel.model?.author}
                            discord={localModel.model?.discord}
                            discordid={localModel.model?.discordid}
                            tags={localModel.model?.tags}
                            selected={false}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
}
