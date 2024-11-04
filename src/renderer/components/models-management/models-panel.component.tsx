import { BSVersion } from "shared/bs-version.interface";
import { useRef, useState } from "react";
import { ModelsGrid } from "./models-grid.component";
import { MSModelType } from "shared/models/models/model-saber.model";
import { BsmDropdownButton, DropDownItem } from "../shared/bsm-dropdown-button.component";
import { ModelsManagerService } from "renderer/services/models-management/models-manager.service";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { BsmButton } from "../shared/bsm-button.component";
import { useService } from "renderer/hooks/use-service.hook";
import { ModelsDownloaderService } from "renderer/services/models-management/models-downloader.service";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { NotificationService } from "renderer/services/notification.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { lastValueFrom, of, take } from "rxjs";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BsContentTabItemProps } from "../shared/bs-content-tab-panel/bs-content-tab-item.component";
import { BsContentTabPanel } from "../shared/bs-content-tab-panel/bs-content-tab-panel.component";
import { ModelTypeAvatarIcon } from "../svgs/icons/model-type-avatar-icon.component";
import { SvgIcon } from "../svgs/svg-icon.type";
import { ModelTypeSaberIcon } from "../svgs/icons/model-type-saber-icon.component";
import { ModelTypePlatformIcon } from "../svgs/icons/model-type-platform-icon.component";
import { ModelTypeBloqIcon } from "../svgs/icons/model-type-bloq-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";

export function ModelsPanel({ version, isActive, goToMods }: { version?: BSVersion; isActive: boolean; goToMods?: () => void }) {
    const modelsManager = useService(ModelsManagerService);
    const modelDownloader = useService(ModelsDownloaderService);
    const notification = useService(NotificationService);
    const config = useService(ConfigurationService);

    const t = useTranslation();

    const ref = useRef();

    const modelsGridRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

    const [modelTypeTab, setModelTypeTab] = useState<MSModelType>(MSModelType.Avatar);
    const [currentTabIndex, setCurrentTabIndex] = useState<number>(0);
    const [search, setSearch] = useState<string>("");

    const modelsLinkStats = {
        [MSModelType.Avatar]: useObservable(() => version ? modelsManager.$modelsLinkingState(version, MSModelType.Avatar) : of(null), FolderLinkState.Unlinked, [version]),
        [MSModelType.Saber]: useObservable(() => version ? modelsManager.$modelsLinkingState(version, MSModelType.Saber) : of(null), FolderLinkState.Unlinked, [version]),
        [MSModelType.Platfrom]: useObservable(() => version ? modelsManager.$modelsLinkingState(version, MSModelType.Platfrom) : of(null), FolderLinkState.Unlinked, [version]),
        [MSModelType.Bloq]: useObservable(() => version ? modelsManager.$modelsLinkingState(version, MSModelType.Bloq) : of(null), FolderLinkState.Unlinked, [version]),
    }

    useOnUpdate(() => {
        if (!isActive || !goToMods) {
            return;
        }
        if (config.get("not-remind-mods-models")) {
            return;
        }
        notification
            .notifyWarning({
                title: "models.notifications.prevent-for-mods.title",
                desc: "models.notifications.prevent-for-mods.desc",
                actions: [
                    { id: "0", title: "models.notifications.prevent-for-mods.go-to-mods" },
                    { id: "1", title: "models.notifications.prevent-for-mods.not-remind", cancel: true },
                ],
                duration: 12_000,
            })
            .then(res => {
                if (res === "0") {
                    return goToMods();
                }
                if (res === "1") {
                    config.set("not-remind-mods-models", true);
                }
            });
    }, [isActive]);

    const exportModels = () => {
        const selectedModels = modelsGridRefs.map(ref => ref.current?.getSelectedModels() as BsmLocalModel[]).flat();
        modelsManager.exportModels(selectedModels, version);
    };

    const deleteModels = () => {
        const activeTab = modelsGridRefs[currentTabIndex];
        activeTab.current?.deleteSelectedModels();
    };

    const openDownloadModal = () => {
        const allLoadedModels = modelsGridRefs.map(ref => ref.current?.getModels() as BsmLocalModel[]).flat();
        modelDownloader.openDownloadModelsModal(version, modelTypeTab, allLoadedModels);
    };

    const threeDotsItems: DropDownItem[] = [
        { text: "models.panel.actions.drop-down.export", onClick: exportModels, icon: "export" },
        { text: "models.panel.actions.drop-down.delete", onClick: deleteModels, icon: "trash" },
    ];

    const getModelTabProps = (model: MSModelType): BsContentTabItemProps => {

        const onClick = async () => {
            const state = await lastValueFrom(modelsManager.$modelsLinkingState(version, model).pipe(take(1)));
            if (state === FolderLinkState.Pending || state === FolderLinkState.Processing) { return; }
            if (state === FolderLinkState.Linked) {
                modelsManager.unlinkModels(model, version);
            } else {
                modelsManager.linkModels(model, version);
            }
        }

        const getModelIcon = (model: MSModelType): SvgIcon => {
            switch (model) {
                case MSModelType.Avatar:
                    return ModelTypeAvatarIcon;
                case MSModelType.Saber:
                    return ModelTypeSaberIcon;
                case MSModelType.Platfrom:
                    return ModelTypePlatformIcon;
                case MSModelType.Bloq:
                    return ModelTypeBloqIcon;
                default:
                    return ModelTypeAvatarIcon;
            }
        }

        return {
            text: `models.types.plural.${model}`,
            icon: getModelIcon(model),
            onClick: () => setModelTypeTab(model),
            linkProps: version ? {
                onClick,
                state: modelsLinkStats[model],
            } : null
        }
    };

    return (
        <div ref={ref} className="w-full h-full flex flex-col items-center justify-center gap-4">
            <div className="w-full shrink-0 flex h-9 justify-center px-40 gap-2 text-main-color-1 dark:text-white">
                <BsmButton
                    className="flex items-center justify-center w-fit rounded-full px-2 py-1 font-bold"
                    icon="add"
                    text="misc.add"
                    typeColor="primary"
                    withBar={false}
                    onClick={e => {
                        e.preventDefault();
                        openDownloadModal();
                    }}
                />
                <div className="h-full rounded-full bg-light-main-color-2 dark:bg-main-color-2 grow p-[6px]">
                    <input type="text" className="h-full w-full bg-light-main-color-1 dark:bg-main-color-1 rounded-full px-2" placeholder={t("models.panel.actions.search")} onChange={e => setSearch(e.target.value)} tabIndex={-1} />
                </div>
                <BsmDropdownButton items={threeDotsItems} className="h-full flex aspect-square relative rounded-full z-[1] bg-light-main-color-1 dark:bg-main-color-3" buttonClassName="rounded-full h-full w-full p-[6px]" icon="three-dots" withBar={false} menuTranslationY="6px" align="center" />
            </div>
            <BsContentTabPanel
                tabIndex={currentTabIndex}
                onTabChange={(index) => setCurrentTabIndex(index)}
                tabs={[
                    getModelTabProps(MSModelType.Avatar),
                    getModelTabProps(MSModelType.Saber),
                    getModelTabProps(MSModelType.Platfrom),
                    getModelTabProps(MSModelType.Bloq),
                ]}
            >
                <>
                    <ModelsGrid ref={modelsGridRefs[0]} version={version} type={MSModelType.Avatar} active={isActive && modelTypeTab === MSModelType.Avatar} search={search} downloadModels={openDownloadModal} />
                    <ModelsGrid ref={modelsGridRefs[1]} version={version} type={MSModelType.Saber} active={isActive && modelTypeTab === MSModelType.Saber} search={search} downloadModels={openDownloadModal} />
                    <ModelsGrid ref={modelsGridRefs[2]} version={version} type={MSModelType.Platfrom} active={isActive && modelTypeTab === MSModelType.Platfrom} search={search} downloadModels={openDownloadModal} />
                    <ModelsGrid ref={modelsGridRefs[3]} version={version} type={MSModelType.Bloq} active={isActive && modelTypeTab === MSModelType.Bloq} search={search} downloadModels={openDownloadModal} />
                </>
            </BsContentTabPanel>
        </div>
    );
}
