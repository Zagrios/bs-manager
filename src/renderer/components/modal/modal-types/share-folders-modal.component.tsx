import { useEffect, useState } from "react";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent, ModalExitCode } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";

export const ShareFoldersModal: ModalComponent<void, BSVersion> = ({ resolver, data }) => {

    const config = ConfigurationService.getInstance();
    const ipc = IpcService.getInstance();

    const [folders, setFolders] = useState<{path: string, linked: boolean}[]>([]);
    const versionPath = useObservable(ipc.sendV2<string>("get-version-full-path", {args: data}), "");

    useEffect(() => {

        const defaultFolders = config.get<string[]>("default-shared-folders");

        const promises = Promise.allSettled(defaultFolders.map(async (folder) => {
            const folderPath = await ipc.sendV2<string>("relative-version-path-to-full", {args: {version: data, relative: folder}}).toPromise();
            const isSymlink = await ipc.sendV2<boolean>("is-folder-symlink", {args: folderPath}).toPromise();
            return {path: folderPath, linked: isSymlink};
        }));

        promises.then((res) => {
            setFolders(() => res.reduce((acc, curent) => {
                if(curent.status !== "fulfilled"){ return acc; }
                acc.push(curent.value);
                return acc;
            }, [] as {path: string, linked: boolean}[]));
        });

    }, []);

    const addFolder = async () => {
        const folder = await ipc.sendV2<{canceled: boolean, filePaths: string[]}, string>("choose-folder", {args: versionPath}).toPromise();
        if(!folder || folder.canceled || !folder.filePaths?.length){ return; }
        const isSymlink = await ipc.sendV2<boolean>("is-folder-symlink", {args: folder.filePaths[0]}).toPromise();
        const linkedFolder = {path: folder.filePaths[0], linked: isSymlink};
        
        const newFolders = [...folders, linkedFolder];
        const filtredMap = new Map<string, {path: string, linked: boolean}>(newFolders.map((folder) => [folder.path, folder]));
        setFolders(() => Array.from(filtredMap.values()));
    }

    const removeFolder = (index: number) => {
        setFolders((prev) => prev.filter((_, i) => i !== index));
    }

    return (
        <form className="w-full max-w-md ">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">Share Folders</h1>
            <p className="my-3">Shared folders allow to share their content with other BeatSaber versions. Please note that the deletion of content is also shared</p>
            <ul className="flex flex-col gap-1 mb-2 h-[300px] max-h-[300px] overflow-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 px-1">
                {folders.map((folder, index) => (
                    <FolderItem key={index} path={folder.path} linked={folder.linked} onDelete={() => {removeFolder(index)}}/>
                ))}
            </ul>
            <div className="w-full h-12 bg-main-color-1 rounded-md flex justify-center items-center cursor-pointer hover:bg-main-color-3" onClick={addFolder}>
                <BsmIcon className="aspect-square h-8" icon="add"/>
                <span className="font-bold">Add folder</span>
            </div>
        </form>
    )
}

type FolderProps = {
    path: string;
    linked: boolean;
    onDelete?: () => void;
}

const FolderItem = ({path, linked, onDelete}: FolderProps) => {

    const name = path.split("\\").at(-1);

    return (
        <li className="w-full h-12 bg-main-color-1 rounded-md shrink-0 flex flex-row items-center justify-between px-2 font-bold">
            <span className="cursor-help" title={path}>{name}</span>
            <div>
                <BsmButton className="aspect-square h-7 rounded-md p-1 bg-main-color-3" icon="trash" withBar={false} onClick={e => {e.preventDefault(); onDelete?.()}}/>
            </div>
        </li>
    )

}
