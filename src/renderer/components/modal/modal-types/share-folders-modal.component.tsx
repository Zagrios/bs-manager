import Tippy from "@tippyjs/react";
import { useEffect, useState } from "react";
import { LinkButton } from "renderer/components/maps-mangement-components/link-button.component";
import { BsmBasicSpinner } from "renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { ConfigurationService } from "renderer/services/configuration.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent } from "renderer/services/modale.service";
import { FolderLinkState, VersionFolderLinkerService, VersionLinkerActionType } from "renderer/services/version-folder-linker.service";
import { BSVersion } from "shared/bs-version.interface";

export const ShareFoldersModal: ModalComponent<void, BSVersion> = ({ data }) => {
    const SHARED_FOLDERS_KEY = "default-shared-folders";

    const config = useService(ConfigurationService);
    const ipc = useService(IpcService);
    const linker = useService(VersionFolderLinkerService);
    const versionManager = useService(BSVersionManagerService);

    const t = useTranslation();

    const [folders, setFolders] = useState<string[]>(Array.from(new Set([...config.get<string[]>(SHARED_FOLDERS_KEY)]).values()));

    useEffect(() => {
        linker
            .getLinkedFolders(data, { relative: true })
            .toPromise()
            .then(linkedFolders => {
                setFolders(prev => Array.from(new Set([...prev, ...linkedFolders]).values()));
            });
    }, []);

    useEffect(() => {
        if (!folders?.length) {
            config.delete(SHARED_FOLDERS_KEY);
            return;
        }

        config.set(SHARED_FOLDERS_KEY, folders);
    }, [folders]);

    const addFolder = async () => {
        const versionPath = await versionManager.getVersionPath(data).toPromise();
        const folder = await ipc.sendV2<{ canceled: boolean; filePaths: string[] }, string>("choose-folder", { args: versionPath }).toPromise();

        if (!folder || folder.canceled || !folder.filePaths?.length) {
            return;
        }

        const relativeFolder = await ipc.sendV2<string>("full-version-path-to-relative", { args: { version: data, fullPath: folder.filePaths[0] } }).toPromise();

        if (folders.includes(relativeFolder)) {
            return;
        }

        setFolders(pre => [...pre, relativeFolder]);
    };

    const removeFolder = (index: number) => {
        setFolders(prev => prev.filter((_, i) => i !== index));
    };

    const linkAll = () => {
        folders.forEach(relativeFolder => linker.linkVersionFolder({ version: data, relativeFolder, type: VersionLinkerActionType.Link }));
    };

    const unlinkAll = () => {
        folders.forEach(relativeFolder => linker.unlinkVersionFolder({ version: data, relativeFolder, type: VersionLinkerActionType.Unlink }));
    }

    return (
        <form className="w-full max-w-md ">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.shared-folders.title")}</h1>
            <p className="my-3">{t("modals.shared-folders.description")}</p>
            <ul className="flex flex-col gap-1 mb-2 h-[300px] max-h-[300px] overflow-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 px-1">
                {folders.map((folder, index) => (
                    <FolderItem
                        key={folder}
                        version={data}
                        relativeFolder={folder}
                        onDelete={() => {
                            removeFolder(index);
                        }}
                    />
                ))}
            </ul>
            <div className="grid grid-flow-col gap-3 grid-cols-3">
                <BsmButton icon="add" className="h-8 rounded-md flex justify-center items-center font-bold bg-light-main-color-1 dark:bg-main-color-1" iconClassName="h-6 aspect-square text-current" onClick={addFolder} withBar={false} text="modals.shared-folders.buttons.add-folder" />
                <BsmButton icon="link" className="h-8 rounded-md flex justify-center items-center font-bold" typeColor="primary" iconClassName="h-6 aspect-square text-current -rotate-45" onClick={linkAll} withBar={false} text="modals.shared-folders.buttons.link-all" />
                <BsmButton icon="unlink" className="h-8 rounded-md flex justify-center items-center font-bold" typeColor="secondary" iconClassName="h-6 aspect-square text-current -rotate-45" onClick={unlinkAll} withBar={false} text="modals.shared-folders.buttons.unlink-all" />
            </div>
        </form>
    );
};

// -------- FOLDER ITEM --------

type FolderProps = {
    version: BSVersion;
    relativeFolder: string;
    onDelete?: () => void;
};

const FolderItem = ({ version, relativeFolder, onDelete }: FolderProps) => {
    const linker = useService(VersionFolderLinkerService);

    const t = useTranslation();

    const color = useThemeColor("first-color");
    const state = useObservable(() => linker.$folderLinkedState(version, relativeFolder), FolderLinkState.Unlinked, [version, relativeFolder]);
    const name = relativeFolder.split(window.electron.path.sep).at(-1);

    const onClickLink = () => {
        if (state === FolderLinkState.Linked) {
            return linker.unlinkVersionFolder({
                version,
                relativeFolder,
                type: VersionLinkerActionType.Unlink,
            });
        }

        return linker.linkVersionFolder({
            version,
            relativeFolder,
            type: VersionLinkerActionType.Link,
        });
    };

    const cancelLink = () => {
        linker.cancelAction(version, relativeFolder);
    };

    return (
        <li className="w-full h-12 rounded-md shrink-0 flex flex-row items-center justify-between px-2 font-bold bg-light-main-color-1 dark:bg-main-color-1">
            <span className="cursor-help" title={relativeFolder}>
                {name}
            </span>
            <div className="flex flex-row gap-1.5">
                <Tippy placement="left" content={t(`modals.shared-folders.buttons.${state === FolderLinkState.Linked ? "unlink-folder" : "link-folder"}`)} arrow={false}>
                    <LinkButton
                        className="p-0.5 h-7 shrink-0 aspect-square blur-0 cursor-pointer hover:brightness-75"
                        state={state}
                        onClick={onClickLink}
                    />
                </Tippy>
                {(() => {
                    if (state === FolderLinkState.Processing) {
                        return <BsmBasicSpinner className="aspect-square h-7 rounded-md p-1 dark:bg-main-color-2" thikness="3.5px" style={{ color }} />;
                    }
                    if (state === FolderLinkState.Pending) {
                        return (
                            <BsmButton
                                className="aspect-square h-7 rounded-md p-1"
                                icon="cross"
                                withBar={false}
                                onClick={e => {
                                    e.preventDefault();
                                    cancelLink();
                                }}
                            />
                        );
                    }
                    return (
                        <BsmButton
                            className="aspect-square h-7 rounded-md p-1"
                            icon="trash"
                            withBar={false}
                            onClick={e => {
                                e.preventDefault();
                                onDelete?.();
                            }}
                        />
                    );
                })()}
            </div>
        </li>
    );
};
