import { useInView } from "framer-motion";
import { BSVersion } from "shared/bs-version.interface";
import { useRef, forwardRef, useImperativeHandle, useState } from "react";
import { MSModelType } from "shared/models/models/model-saber.model";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { useSwitchableObservable } from "renderer/hooks/use-switchable-observable.hook";
import { Progression } from "main/helpers/fs.helpers";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ModelItem } from "./model-item.component";
import { useBehaviorSubject } from "renderer/hooks/use-behavior-subject.hook";
import { BsmImage } from "../shared/bsm-image.component";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png"
import BeatConflict from "../../../../assets/images/apngs/beat-conflict.png"
import TextProgressBar from "../progress-bar/text-progress-bar.component";
import { BehaviorSubject, distinctUntilChanged, map, startWith, tap } from "rxjs";
import { BsmButton } from "../shared/bsm-button.component";
import equal from "fast-deep-equal";
import { VersionLinkerAction, VersionLinkerActionListener } from "renderer/services/version-folder-linker.service";
import { MODEL_TYPE_FOLDERS } from "shared/models/models/constants";

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

    const [models, setModelsLoadObservable,, setModels] = useSwitchableObservable<BsmLocalModel[]>();
    const [progress$, setProgress$] = useState(new BehaviorSubject(0).asObservable());
    const [modelsSelected, modelsSelected$] = useBehaviorSubject<BsmLocalModel[]>([]);

    const isLoading = !models;
    const hasModels = !!models?.length;

    useImperativeHandle(forwardRef, () => ({
        getModels: () => {
            return models ?? [];
        },
        getSelectedModels: () => {
            return modelsSelected;
        },
        reloadModels: () => {
            loadModels();
        },
        deleteSelectedModels: () => {
            modelsManager.deleteModels(modelsSelected, version).then(deleted => {
                if(!deleted){ return; }
                const newModels = models.filter(m => !modelsSelected.some(d => d.hash === m.hash));
                setModels(() => newModels);
                modelsSelected$.next([]);
            });

        }
    }), [modelsSelected, models]);

    useOnUpdate(() => {
        if(!isVisible){ return; }
        loadModels();

        const onLinkStateChangeCb = (action: VersionLinkerAction) => {
            if(!equal(version, action.version) || !action.relativeFolder.includes(MODEL_TYPE_FOLDERS[type])){ return; }
            loadModels();
        }

        modelsManager.onModelsFolderLinked(onLinkStateChangeCb);
        modelsManager.onModelsFolderUnlinked(onLinkStateChangeCb);

        return () => {
            modelsManager.removeModelsFolderLinkedListener(onLinkStateChangeCb);
            modelsManager.removeModelsFolderUnlinkedListener(onLinkStateChangeCb);
        }

    }, [version, isVisible, type]);

    const loadModels = () => {
        const modelsObs$ = modelsManager.$getModels(type, version);
        setModelsLoadObservable(() => modelsObs$.pipe(map(models => models?.extra), distinctUntilChanged()));
        setProgress$(modelsObs$.pipe(map(models => Math.floor((models.current / models.total) * 100)), startWith(0), distinctUntilChanged()))
    }

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
        if(!active){ return models; }
        
        const lowerSearch = search?.toLowerCase();

        return models?.filter(model => {
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

    const renderContent = () => {
        if(isLoading){
            return (
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200">
                    <BsmImage className="w-32 h-32 spin-loading" image={BeatWaitingImg}/>
                    <span className="font-bold">Chargement des models...</span> {/** TODO TRANSLATE **/}
                    <TextProgressBar value$={progress$}/>
                </div>
            )
        }

        if(!hasModels){
            return (
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200">
                    <BsmImage className="h-32" image={BeatConflict}/>
                    <span className="font-bold">Aucun modelès</span> {/** TODO TRANSLATE **/}
                    <BsmButton className="font-bold rounded-md p-2" text="Télécharger des modèles" typeColor="primary" withBar={false} onClick={e => {e.preventDefault();}}/>
                </div>
            )
        }

        return (
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
        )
    }

    return (
        <div ref={ref} className={`w-full h-full flex-shrink-0 ${className ?? ""}`}>
            {renderContent()}
        </div>
    )
})
