import { motion } from "framer-motion";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../../assets/images/apngs/beat-conflict.png";
import { MSGetQuery, MSGetSort, MSGetSortDirection, MSModel, MSModelPlatform, MSModelType } from "shared/models/models/model-saber.model";
import { useCallback, useState } from "react";
import { ModelItem } from "renderer/components/models-management/model-item.component";
import { useService } from "renderer/hooks/use-service.hook";
import { ModelDownload, ModelsDownloaderService } from "renderer/services/models-management/models-downloader.service";
import { ModelSaberService } from "renderer/services/thrird-partys/model-saber.service";
import { useBehaviorSubject } from "renderer/hooks/use-behavior-subject.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { MODEL_TYPES, MS_GET_QUERY_SORTS } from "shared/models/models/constants";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import equal from "fast-deep-equal";
import { catchError, of } from "rxjs";
import Tippy from "@tippyjs/react";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";

export const DownloadModelsModal: ModalComponent<void, { version: BSVersion; type: MSModelType; owned: BsmLocalModel[] }> = ({ data: { version, type, owned } }) => {
    const modelsDownloader = useService(ModelsDownloaderService);
    const modelSaber = useService(ModelSaberService);
    const os = useService(OsDiagnosticService);

    const t = useTranslation();

    const modelTypesOptions = useConstant<BsmSelectOption<MSModelType>[]>(() =>
        MODEL_TYPES.map(type => ({
            text: `models.types.plural.${type}`,
            value: type,
        }))
    );

    const querySortsOptions = useConstant<BsmSelectOption<MSGetSort>[]>(() =>
        MS_GET_QUERY_SORTS.map(sort => ({
            text: `models.sorts.${sort}`,
            value: sort,
        }))
    );

    const currentDownload = useObservable(modelsDownloader.currentDownload$(), null);
    const downloadQueue = useObservable(modelsDownloader.getQueue$(), []);
    const [msModels, msModels$] = useBehaviorSubject<MSModel[]>([]);
    const isOnline = useObservable(os.isOnline$, true);
    const [error, error$] = useBehaviorSubject(false);
    const [isLoading, isLoading$] = useBehaviorSubject(false);
    const [ownedModels, setOwnedModels] = useState<BsmLocalModel[]>(owned ?? []);

    const [currentType, currentType$] = useBehaviorSubject<MSModelType>(type);
    const [currentSort, currentSort$] = useBehaviorSubject<MSGetSort>(MSGetSort.Date);
    const [searhInput, searhInput$] = useBehaviorSubject("");
    const [getQuery, getQuery$] = useBehaviorSubject<MSGetQuery>({ type: currentType, platform: MSModelPlatform.PC, start: 0, end: 25, sort: currentSort, sortDirection: MSGetSortDirection.Descending });

    useOnUpdate(() => {
        const sub = modelsDownloader.onModelsDownloaded(model => {
            if (!equal(model.version, version)) {
                return;
            }
            setOwnedModels(prev => [...(prev ?? []), model]);
        });

        return () => sub.unsubscribe();
    });

    useOnUpdate(() => {
        error$.next(false);
        isLoading$.next(true);

        const sub = modelSaber
            .searchModels(getQuery)
            .pipe(
                catchError(() => {
                    error$.next(true);
                    return of([]);
                })
            )
            .subscribe(models => {
                msModels$.next([...msModels, ...models]);
                isLoading$.next(false);
            });

        return () => sub.unsubscribe();
    }, [getQuery]);

    useOnUpdate(() => {
        msModels$.next([]);

        getQuery$.next({
            ...getQuery$.value,
            start: 0,
            end: 25,
            type: currentType,
            sort: currentSort,
        });
    }, [currentType, currentSort]);

    const loadMore = () => {
        const currentQuery = getQuery;
        currentQuery.start += 25;
        currentQuery.end += 25;
        getQuery$.next({ ...currentQuery });
    };

    const search = () => {
        const getQuery: MSGetQuery = {
            start: 0,
            end: 25,
            type: currentType,
            sort: currentSort,
            filter: modelSaber.parseFilter(searhInput),
        };

        msModels$.next([]);
        getQuery$.next(getQuery);
    };

    const handleDownloadModel = useCallback((model: MSModel) => {
        modelsDownloader.addModelToDownload({ model, version });
    }, []);

    const handleCancelDownload = useCallback((model: MSModel) => {
        modelsDownloader.removeFromDownloadQueue({ model, version });
    }, []);

    const modelPendingDownload = (model: MSModel) => {
        return downloadQueue.some(download => download.model.id === model.id && equal(download.version, version));
    };

    const isModelOwned = (model: MSModel) => {
        return !!ownedModels.some(owned => owned.hash === model.hash);
    };

    const renderFilterTips = useConstant(() => (
        <div className="w-fit flex">
            <table className="w-fit whitespace-nowrap grow shrink-0 text-sm">
                <tbody>
                    <tr className="font-bold">
                        <td className="mr-3 block">{t("models.modals.download-models.search-tips.header.tag")}</td>
                        <td>{t("models.modals.download-models.search-tips.header.desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">author:</td>
                        <td>{t("models.modals.download-models.search-tips.author-desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">tag:</td>
                        <td>{t("models.modals.download-models.search-tips.tag-desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">hash:</td>
                        <td>{t("models.modals.download-models.search-tips.hash-desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">name:</td>
                        <td>{t("models.modals.download-models.search-tips.name-desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">discordid:</td>
                        <td>{t("models.modals.download-models.search-tips.discordid-desc")}</td>
                    </tr>
                    <tr>
                        <td className="mr-3 block">status:</td>
                        <td>{t("models.modals.download-models.search-tips.status-desc")}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    ));

    const renderLoadingStatus = () => {
        if (isLoading) {
            return <span className="text-lg">{t("models.panel.grid.loading")}</span>;
        }
        if (isOnline) {
            return <span className="text-lg">{t("models.modals.download-models.no-models")}</span>;
        }
        if (!isOnline) {
            return <span className="text-lg">{t("models.modals.download-models.no-internet")}</span>;
        }
        return <span className="text-lg">{t("models.modals.download-models.error-occured")}</span>;
    };

    return (
        <form
            className="text-gray-800 dark:text-gray-200 flex flex-col max-w-[95vw] w-[970px] h-[85vh] gap-3"
            onSubmit={e => {
                e.preventDefault();
                search();
            }}
        >
            <div className="flex h-9 gap-2 shrink-0">
                <BsmSelect className="bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-1 pb-0.5 text-center capitalize" options={modelTypesOptions} selected={currentType} onChange={value => currentType$.next(value)} />
                <div className="h-ful grow relative flex justify-center items-center">
                    <input className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 pb-0.5" type="text" name="" id="" placeholder={t("models.modals.download-models.search-placeholder")} value={searhInput} onChange={e => searhInput$.next(e.target.value)} />
                    <Tippy placement="bottom" content={renderFilterTips} allowHTML maxWidth={Infinity}>
                        <div className="absolute right-0 h-full w-fit p-1 cursor-pointer">
                            <BsmButton className="h-full rounded-full p-1 aspect-square" typeColor="primary" icon="info" withBar={false} />
                        </div>
                    </Tippy>
                </div>
                <BsmButton
                    className="shrink-0 rounded-full py-1 px-3 !bg-light-main-color-1 dark:!bg-main-color-1 flex justify-center items-center capitalize"
                    icon="search"
                    type="submit"
                    text="models.modals.download-models.search-btn"
                    withBar={false}
                    onClick={e => {
                        e.preventDefault();
                        search();
                    }}
                />
                <BsmSelect className="bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-1 pb-0.5 text-center capitalize" options={querySortsOptions} onChange={value => currentSort$.next(value)} />
            </div>
            <ul className="w-full grow flex content-start flex-wrap gap-4 pt-1.5 px-2 overflow-y-scroll overflow-x-hidden scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 z-0">
                {msModels.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img className={`w-32 h-32 ${isLoading && "spin-loading"}`} src={isLoading && !error ? BeatWaitingImg : BeatConflictImg} alt=" " />
                        {renderLoadingStatus()}
                    </div>
                ) : (
                    <>
                        {msModels.map(model => (
                            <ModelItem key={model.id} {...model} callbackValue={model} isDownloading={equal(currentDownload, { model, version } as ModelDownload)} onDownload={!isModelOwned(model) ? handleDownloadModel : undefined} onDoubleClick={!isModelOwned(model) ? handleDownloadModel : undefined} onCancelDownload={modelPendingDownload(model) ? handleCancelDownload : undefined} />
                        ))}
                        <motion.span onViewportEnter={loadMore} className="block w-full h-8" />
                    </>
                )}
            </ul>
        </form>
    );
};
