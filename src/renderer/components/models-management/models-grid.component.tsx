import { useInView } from "framer-motion";
import { BSVersion } from "shared/bs-version.interface";
import { useRef, forwardRef, useImperativeHandle } from "react";
import { MSModelType } from "shared/models/models/model-saber.model";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { useSwitchableObservable } from "renderer/hooks/use-switchable-observable.hook";
import { Progression } from "main/helpers/fs.helpers";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ModelItem } from "./model-item.component";
import { useBehaviorSubject } from "renderer/hooks/use-behavior-subject.hook";

type Props = {
    className?: string,
    version?: BSVersion,
    type: MSModelType
}

export const ModelsGrid = forwardRef(({className, version, type}: Props, forwardRef) => {

    const modelsManager = useConstant(() => ModelsManagerService.getInstance());

    const ref = useRef();
    const isVisible = useInView(ref, {once: true, amount: .1});

    const [models, setModelsLoadObservable] = useSwitchableObservable<Progression<BsmLocalModel[]>>();
    const [modelsSelected, modelsSelected$] = useBehaviorSubject<Set<BsmLocalModel>>(new Set());
    const isLoading = !models || !models?.extra;
    const hasModels = !isLoading && models?.extra.length;

    useImperativeHandle(forwardRef, () => ({
        getModels: () => {
            console.log(type, models?.extra);
            return models?.extra ?? [];
        },
        getSelectedModels: () => {
            return Array.from(modelsSelected)
        },
        reloadModels: () => {
            setModelsLoadObservable(() => modelsManager.$getModels(type, version));
        }
    }), [modelsSelected, models]);

    useOnUpdate(() => {
        if(!isVisible){ return; }
        setModelsLoadObservable(() => modelsManager.$getModels(type, version));
    }, [version, isVisible, type]);

    const handleModelClick = (model: BsmLocalModel) => {
        const newSet = new Set(modelsSelected);
        if(newSet.has(model)){
            newSet.delete(model);
        } 
        else {
            newSet.add(model);
        }
        modelsSelected$.next(newSet);
    }

    return (
        <div ref={ref} className={`w-full h-full flex-shrink-0 ${className ?? ""}`}>
            {isLoading && <>loading</>}
            {!hasModels && <>no models</>}
            {hasModels && !isLoading && (
                <ul className="flex flex-wrap shrink-0 justify-start content-start w-full h-full overflow-y-scroll overflow-x-hidden p-4 gap-4 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
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
                            selected={modelsSelected.has(localModel)}
                            path={localModel.path}
                            onClick={() => handleModelClick(localModel)}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
})
