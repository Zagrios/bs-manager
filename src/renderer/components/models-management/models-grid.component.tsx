import { BSVersion } from "shared/bs-version.interface";
import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import { MSModelType } from "shared/models/models/model-saber.model";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { useSwitchableObservable } from "renderer/hooks/use-switchable-observable.hook";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { ModelItem } from "./model-item.component";
import { BsmImage } from "../shared/bsm-image.component";
import BeatConflict from "../../../../assets/images/apngs/beat-conflict.png";
import { BehaviorSubject, distinctUntilChanged, map, startWith } from "rxjs";
import { BsmButton } from "../shared/bsm-button.component";
import equal from "fast-deep-equal";
import { VersionLinkerAction } from "renderer/services/version-folder-linker.service";
import { MODEL_TYPE_FOLDERS } from "shared/models/models/constants";
import { useService } from "renderer/hooks/use-service.hook";
import { ModelsDownloaderService } from "renderer/services/models-management/models-downloader.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsContentLoader } from "../shared/bs-content-loader.component";
import { VirtualScroll } from "../shared/virtual-scroll/virtual-scroll.component";
import { noop } from "shared/helpers/function.helpers";

type Props = {
    className?: string;
    version?: BSVersion;
    type: MSModelType;
    search?: string;
    active: boolean;
    downloadModels?: () => void;
};

export const ModelsGrid = forwardRef<unknown, Props>(({ className, version, type, search, active, downloadModels }, forwardRef) => {
    const modelsManager = useService(ModelsManagerService);
    const modelsDownloader = useService(ModelsDownloaderService);

    const t = useTranslation();

    const [models, setModelsLoadObservable, , setModels] = useSwitchableObservable<BsmLocalModel[]>();
    const [renderableModels, setRenderableModels] = useState<RenderableModel[]>([]);
    const progress$ = useConstant(() => new BehaviorSubject(0));
    const [modelsSelected, setModelsSelected] = useState<BsmLocalModel[]>([]);

    const isLoading = !models;
    const hasModels = !!models?.length;

    useImperativeHandle(
        forwardRef,
        () => ({
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
                modelsManager.deleteModels(!modelsSelected?.length ? models : modelsSelected, version).then(deletedModels => {
                    if (!deletedModels?.length) {
                        return;
                    }
                    const newModels = models.filter(m => !deletedModels.some(d => d.hash === m.hash));
                    setModels(() => newModels);
                    setModelsSelected(() => []);
                });
            },
        }),
        [modelsSelected, models]
    );

    useOnUpdate(() => setRenderableModels(() => (
        models?.map(model => ({
            model,
            selected: modelsSelected.some(m => m.hash === model.hash)
        })) ?? [])
    ), [modelsSelected, models]);

    useOnUpdate(() => {
        if (!active) {
            return;
        }
        if (models?.length) {
            return;
        }
        loadModels();
    }, [active]);

    useOnUpdate(() => {
        if (!active) {
            setModels(() => null);
        } else {
            loadModels();
        }
    }, [version, type]);

    useOnUpdate(() => {
        if (!active && !models) {
            return noop;
        }

        const onLinkStateChangeCb = (action: VersionLinkerAction) => {
            if (!equal(version, action.version) || !action.relativeFolder.includes(MODEL_TYPE_FOLDERS[type])) {
                return;
            }
            loadModels();
        };

        const sub = modelsDownloader.onModelsDownloaded(localModel => {
            if (localModel.type !== type || !equal(localModel.version, version)) {
                return;
            }
            setModels(models => [localModel, ...(models ?? [])]);
        });

        modelsManager.onModelsFolderLinked(onLinkStateChangeCb);
        modelsManager.onModelsFolderUnlinked(onLinkStateChangeCb);

        return () => {
            modelsManager.removeModelsFolderLinkedListener(onLinkStateChangeCb);
            modelsManager.removeModelsFolderUnlinkedListener(onLinkStateChangeCb);
            sub.unsubscribe();
        };
    }, [version, type, active]);

    const loadModels = () => {
        const modelsObs$ = modelsManager.$getModels(type, version);
        setModels(() => null);
        setModelsLoadObservable(() =>
            modelsObs$.pipe(
                map(models => models?.data),
                distinctUntilChanged()
            )
        );
        modelsObs$
            .pipe(
                map(models => Math.floor((models.current / models.total) * 100)),
                startWith(0),
                distinctUntilChanged()
            )
            .subscribe({ next: v => progress$.next(v) });
    };

    const handleModelClick = (model: BsmLocalModel) => {
        setModelsSelected(prev => {
            const newModels = [...prev];
            const index = newModels.findIndex(m => m.hash === model.hash);
            if (index === -1) {
                newModels.push(model);
            } else {
                newModels.splice(index, 1);
            }
            return newModels;

        });
    };

    const filtredModels = () => {
        if (!active) {
            return renderableModels;
        }

        const lowerSearch = search?.toLowerCase();

        return renderableModels?.filter(model => {
            const findedInRawValues = Object.values(model.model).some(value => {
                if (typeof value !== "string" && typeof value !== "number") {
                    return false;
                }
                return value.toString().toLowerCase().includes(lowerSearch);
            });

            if (findedInRawValues) {
                return true;
            }

            if (!model.model.model) {
                return false;
            }

            return Object.values(model.model.model).some(value => {
                if (typeof value !== "string" && typeof value !== "number" && !Array.isArray(value)) {
                    return false;
                }

                if (Array.isArray(value)) {
                    return value.some(v => v.toString().toLowerCase().includes(lowerSearch));
                }

                return value.toString().toLowerCase().includes(lowerSearch);
            });
        });
    };

    const handleDelete = (model: BsmLocalModel) => {
        modelsManager.deleteModels([model], version).then(deleted => {
            if (!deleted?.length) {
                return;
            }
            setModels(prev => prev.filter(m => m.hash !== model.hash));
            setModelsSelected(modelsSelected => modelsSelected.filter(m => m.hash !== model.hash));
        });
    };

    const renderModel = useCallback((renderableModel: RenderableModel) => {

            const { model } = renderableModel;

            return (
                <ModelItem
                    {...model?.model}
                    key={model.path}
                    hash={model.model?.hash ?? model.hash}
                    path={model.path}
                    type={model.type}
                    name={model.model?.name ?? model.fileName}
                    selected={renderableModel.selected}
                    onClick={() => handleModelClick(model)}
                    onDelete={() => handleDelete(model)}
                />
            )
    }, [version]);

    const renderContent = () => {
        if (isLoading) {
            return (
                <BsContentLoader className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200" value$={progress$} text="models.panel.grid.loading" />
            );
        }

        if (!hasModels) {
            return (
                <div className="h-full flex flex-col items-center justify-center flex-wrap gap-1 text-gray-800 dark:text-gray-200">
                    <BsmImage className="h-32" image={BeatConflict} />
                    <span className="font-bold">{t("models.panel.grid.no-models")}</span>
                    <BsmButton
                        className="font-bold rounded-md p-2"
                        text="models.panel.grid.download-models"
                        typeColor="primary"
                        withBar={false}
                        onClick={e => {
                            e.preventDefault();
                            downloadModels?.();
                        }}
                    />
                </div>
            );
        }

        return (
            <VirtualScroll
                classNames={{
                    mainDiv: "size-full",
                    rows: "gap-x-4 p-4"
                }}
                itemHeight={272}
                minItemWidth={256}
                maxColumns={Infinity}
                items={filtredModels()}
                rowKey={rowModels => rowModels.map(m => m.model.path).join("-")}
                renderItem={renderModel}

            />
        );
    };

    return (
        <div className={`size-full flex-shrink-0 ${className ?? ""}`}>
            {renderContent()}
        </div>
    );
});

type RenderableModel = {
    model: BsmLocalModel;
    selected: boolean;
};
