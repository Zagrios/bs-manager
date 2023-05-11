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
    search?: string,
    active: boolean
}

export const ModelsGrid = forwardRef(({className, version, type, search, active}: Props, forwardRef) => {

    const modelsManager = useConstant(() => ModelsManagerService.getInstance());

    const ref = useRef();
    const isVisible = useInView(ref, {once: true, amount: .1});

    const [models, setModelsLoadObservable,, setModels] = useSwitchableObservable<Progression<BsmLocalModel[]>>();
    const [modelsSelected, modelsSelected$] = useBehaviorSubject<BsmLocalModel[]>([]);
    const isLoading = !models || !models?.extra;
    const hasModels = !isLoading && models?.extra.length;

    useImperativeHandle(forwardRef, () => ({
        getModels: () => {
            console.log(type, models?.extra);
            return models?.extra ?? [];
        },
        getSelectedModels: () => {
            return modelsSelected;
        },
        reloadModels: () => {
            setModelsLoadObservable(() => modelsManager.$getModels(type, version));
        },
        deleteSelectedModels: () => {
            modelsManager.deleteModels(modelsSelected, version).then(deleted => {
                if(!deleted){ return; }
                models.extra = models.extra.filter(m => !modelsSelected.some(d => d.hash === m.hash));
                setModels(() => models);
                modelsSelected$.next([]);
            });

        }
    }), [modelsSelected, models]);

    useOnUpdate(() => {
        if(!isVisible){ return; }
        setModelsLoadObservable(() => modelsManager.$getModels(type, version));
    }, [version, isVisible, type]);

    const handleModelClick = (model: BsmLocalModel) => {
        const prunedArray = Array.from(new Set(modelsSelected));
        if(prunedArray.some(m => m.hash === model.hash)){
            prunedArray.splice(prunedArray.findIndex(m => m.hash === model.hash), 1);
        } 
        else {
            prunedArray.push(model);
        }
        modelsSelected$.next(prunedArray);
    }

    const filtredModels = () => {
        if(!active){ return models?.extra; }
        
        const lowerSearch = search?.toLowerCase();

        return models?.extra?.filter(model => {
            const findedInRawValues = Object.values(model).some(value => {
                if(typeof value !== "string" && typeof value !== "number"){ return false; }
                return value.toString().toLowerCase().includes(lowerSearch);
            });

            if(findedInRawValues) { return true; }

            if(!model.model){ return false; }

            return Object.values(model.model).some(value => {
                if(typeof value !== "string" && typeof value !== "number" && !Array.isArray(value)){ return false; }

                if(Array.isArray(value)){
                    return value.some(v => v.toString().toLowerCase().includes(lowerSearch));
                }

                return value.toString().toLowerCase().includes(lowerSearch);
            });
        })
    }

    return (
        <div ref={ref} className={`w-full h-full flex-shrink-0 ${className ?? ""}`}>
            {isLoading && <>loading</> /** TODO that **/}
            {!hasModels && <>no models</> /** TODO that **/}
            {hasModels && !isLoading && (
                <ul className="flex flex-wrap shrink-0 justify-start content-start w-full h-full overflow-y-scroll overflow-x-hidden p-4 gap-4 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
                    {filtredModels().map(localModel => (
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
                            selected={modelsSelected.some(m => m.hash === localModel.hash)}
                            path={localModel.path}
                            onClick={() => handleModelClick(localModel)}
                        />
                    ))}
                </ul>
            )}
        </div>
    )
})
