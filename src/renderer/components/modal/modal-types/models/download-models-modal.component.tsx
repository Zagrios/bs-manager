import { motion } from "framer-motion";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmSelect, BsmSelectOption } from "renderer/components/shared/bsm-select.component";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";
import BeatWaitingImg from "../../../../../../assets/images/apngs/beat-waiting.png";
import BeatConflictImg from "../../../../../../assets/images/apngs/beat-conflict.png";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { MSGetQuery, MSGetSort, MSGetSortDirection, MSModel, MSModelPlatform, MSModelType } from "shared/models/models/model-saber.model";
import { useCallback, useMemo, useState } from "react";
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
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import Tippy from "@tippyjs/react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";

export const DownloadModelsModal: ModalComponent<void, {version: BSVersion, type: MSModelType}> = ({resolver, data: { version, type }}) => {

    const modelsDownloader = useService(ModelsDownloaderService);
    const modelSaber = useService(ModelSaberService);
    const os = useService(OsDiagnosticService);

    const modelTypesOptions = useConstant<BsmSelectOption<MSModelType>[]>(() => MODEL_TYPES.map(type => ({
        text: type.toString(),  // TODO TRANSLATE
        value: type
    })));

    const querySortsOptions = useConstant<BsmSelectOption<MSGetSort>[]>(() => MS_GET_QUERY_SORTS.map(sort => ({
        text: sort.toString(),  // TODO TRANSLATE
        value: sort
    })));

    const t = useTranslation();
    const color = useThemeColor("first-color");
    const currentDownload = useObservable(modelsDownloader.currentDownload$(), null);
    const [msModels, msModels$] = useBehaviorSubject<MSModel[]>([]);
    const isOnline = useObservable(os.isOnline$, true);
    const [error, error$] = useBehaviorSubject(false);
    const [isLoading, isLoading$] = useBehaviorSubject(false);

    console.log(msModels);
    
    const [currentType, currentType$] = useBehaviorSubject<MSModelType>(type);
    const [currentSort, currentSort$] = useBehaviorSubject<MSGetSort>(MSGetSort.Date);
    const [searhInput, searhInput$] = useBehaviorSubject("");
    const [getQuery, getQuery$] = useBehaviorSubject<MSGetQuery>({ type: currentType, platform: MSModelPlatform.PC, start: 0, end: 25, sort: currentSort, sortDirection: MSGetSortDirection.Descending });

    useOnUpdate(() => {
        error$.next(false);
        const sub = modelSaber.searchModels(getQuery).pipe(catchError(() => {
            error$.next(true);
            return of([]);
        })).subscribe(models => msModels$.next([...msModels, ...models]));
        return () => sub.unsubscribe();
    }, [getQuery])

    useOnUpdate(() => {
        msModels$.next([]);



        getQuery$.next({
            ...getQuery$.value,
            start: 0,
            end: 25,
            type: currentType,
            sort: currentSort
        });

    }, [currentType, currentSort]);

    const loadMore = () => {
        console.log("load more");
        const currentQuery = getQuery;
        currentQuery.start += 25;
        currentQuery.end += 25;
        getQuery$.next({...currentQuery});
    }

    const search = () => {

        const filters = searhInput.split(" ").join(",");

        const getQuery: MSGetQuery = {
            start: 0, end: 25,
            type: currentType,
            sort: currentSort,
            filter: modelSaber.parseFilter(searhInput)
        };

        msModels$.next([]);
        getQuery$.next(getQuery);

    }

    const handleDownloadModel = useCallback((model: MSModel) => {
        modelsDownloader.addModelToDownload({...model, version});
    }, []);

    const filterTipsHTML = useConstant(() => (
        <div className="w-fit flex">
            <table className="w-fit whitespace-nowrap grow shrink-0 text-base">
                <tbody>
                    <tr className="font-bold"><td className="mr-3 block">Tag</td><td>Description</td></tr>
                    <tr><td className="mr-3 block">author:</td><td>Only show models by the specified author.</td></tr>
                    <tr><td className="mr-3 block">hash:</td><td>Only show models with the specified hash.</td></tr>
                    <tr><td className="mr-3 block">tag:</td><td>Only show models with the specified tag.</td></tr>
                    <tr><td className="mr-3 block">name:</td><td>Only show models with the specified name.</td></tr>
                    <tr><td className="mr-3 block">discordid:</td><td>Only show models by the user with the specified discordid.</td></tr>
                    <tr><td className="mr-3 block">status:</td><td>Only show models with the specified approval status. (profile only, and only for the author)</td></tr>
                </tbody>
            </table>
        </div>
    ))

    return (
        <form className="text-gray-800 dark:text-gray-200 flex flex-col max-w-[95vw] w-[970px] h-[85vh] gap-3" onSubmit={e => {e.preventDefault(); search()}}>
            <div className="flex h-9 gap-2 shrink-0">
                <BsmSelect className="bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-1 pb-0.5 text-center" options={modelTypesOptions} onChange={(value) => currentType$.next(value)}/>
                <div className="h-ful grow relative flex justify-center items-center">
                    <input className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2 pb-0.5" type="text" name="" id="" placeholder="TODO TRANSLATE Rechercher un modèle" value={searhInput} onChange={e => searhInput$.next(e.target.value)}/>
                    <Tippy placement="bottom" content={filterTipsHTML} allowHTML={true} maxWidth={Infinity}>
                        <div className="absolute right-0 h-full w-fit p-1 cursor-pointer">
                            <BsmButton className="h-full rounded-full p-1 aspect-square" typeColor="primary" icon="info" withBar={false}/>
                        </div>
                    </Tippy>
                    
                </div>
                <BsmButton className="shrink-0 rounded-full py-1 px-3 !bg-light-main-color-1 dark:!bg-main-color-1 flex justify-center items-center capitalize" icon="search" type="submit" text="modals.download-maps.search-btn" withBar={false} onClick={e => {e.preventDefault(); search()}}/>
                <BsmSelect className="bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-1 pb-0.5 text-center" options={querySortsOptions} onChange={(value) => currentSort$.next(value)}/>
            </div>
            <ul className="w-full grow flex content-start flex-wrap gap-4 pt-1.5 px-2 overflow-y-scroll overflow-x-hidden scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 z-0" >
                {msModels.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                        <img className={`w-32 h-32 ${isLoading && "spin-loading"}`} src={isLoading ? BeatWaitingImg : BeatConflictImg} alt=" "/>
                        <span className="text-lg">{t(isLoading ? "Chargement des modèles" : isOnline ? "Aucun modèles trouvés" : "Pas d'internet")}</span> {/** TODO TRANSLATE **/}
                    </div>
                ) : (
                    <>
                        {msModels.map(model => (
                            <ModelItem 
                                key={model.id} 
                                {...model}
                                callbackValue={model}
                                isDownloading={equal(currentDownload, {...model, version} as ModelDownload)}
                                onDownload={handleDownloadModel}
                            />
                        ))}
                        <motion.span onViewportEnter={loadMore} className="block w-full h-8"/>
                    </>
                )}
            </ul>
        </form>
    )
}
