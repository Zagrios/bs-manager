import Tippy from "@tippyjs/react";
import { Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { LinkButton } from "renderer/components/maps-mangement-components/link-button.component";
import { BsmBasicSpinner } from "renderer/components/shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmIcon } from "renderer/components/svgs/bsm-icon.component";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { FolderLinkerService } from "renderer/services/folder-linker.service";
import { IpcService } from "renderer/services/ipc.service";
import { ModalComponent } from "renderer/services/modale.service";
import { BSVersion } from "shared/bs-version.interface";

export const ShareFoldersModal: ModalComponent<void, BSVersion> = ({ data }) => {

    const SHARED_FOLDERS_KEY = "default-shared-folders";

    const config = ConfigurationService.getInstance();
    const ipc = IpcService.getInstance();

    const t = useTranslation();

    const [folders, setFolders] = useState<string[]>([]);
    const versionPath = useObservable(ipc.sendV2<string>("get-version-full-path", {args: data}));

    useEffect(() => {

        const defaultFolders = config.get<string[]>(SHARED_FOLDERS_KEY);

        const promises = Promise.allSettled(defaultFolders.map(async (folder) => {
            return ipc.sendV2<string>("relative-version-path-to-full", {args: {version: data, relative: folder}}).toPromise();
        }));
    
        promises.then((res) => {

            const fullPathFolders = res.reduce((acc, curent) => {
                if(curent.status !== "fulfilled"){ return acc; }
                acc.push(curent.value);
                return acc;
            }, []);

            setFolders(prev => Array.from(new Set([...prev, ...fullPathFolders]).values()));
        });

        ipc.sendV2<string[]>("get-linked-folders", {args: data}).toPromise().then(linkedFolders => {
            setFolders(prev => Array.from(new Set([...prev, ...linkedFolders]).values()));
        });

    }, []);

    useEffect(() => {

        if(!folders?.length){
            config.delete(SHARED_FOLDERS_KEY);
            return; 
        }

        const promises = Promise.allSettled(folders.map(async folder => {
            return ipc.sendV2<string>("full-version-path-to-relative", {args: {version: data, fullPath: folder}}).toPromise();
        }));

        promises.then((res) => {
            const sharedFolders = res.reduce((acc, curent) => {
                if(curent.status !== "fulfilled"){ return acc; }
                acc.push(curent.value);
                return acc;
            }, [] as string[]);
            config.set(SHARED_FOLDERS_KEY, sharedFolders);
        });

    }, [folders]);

    const addFolder = async () => {
        const folder = await ipc.sendV2<{canceled: boolean, filePaths: string[]}, string>("choose-folder", {args: versionPath}).toPromise();
        
        if(!folder || folder.canceled || !folder.filePaths?.length){ return; }
        const linkedFolder = folder.filePaths[0];

        if(folders.includes(linkedFolder)){ return; }

        setFolders(pre => [...pre, linkedFolder]);
    }

    const removeFolder = (index: number) => {
        setFolders((prev) => prev.filter((_, i) => i !== index));
    }

    return (
        <form className="w-full max-w-md ">
            <h1 className="text-3xl uppercase tracking-wide w-full text-center text-gray-800 dark:text-gray-200">{t("modals.shared-folders.title")}</h1>
            <p className="my-3">{t("modals.shared-folders.description")}</p>
            <ul className="flex flex-col gap-1 mb-2 h-[300px] max-h-[300px] overflow-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900 px-1">
                {folders.map((folder, index) => (
                    <FolderItem key={index} path={folder} onDelete={() => {removeFolder(index)}}/>
                ))}
            </ul>
            <div className="w-full h-12 rounded-md flex justify-center items-center cursor-pointer bg-light-main-color-1 dark:bg-main-color-1 hover:bg-light-main-color-3 hover:dark:bg-main-color-3" onClick={addFolder}>
                <BsmIcon className="aspect-square h-8" icon="add"/>
                <span className="font-bold">{t("modals.shared-folders.buttons.add-folder")}</span>
            </div>
        </form>
    )
}

type FolderProps = {
    path: string;
    onDelete?: () => void;
}

const FolderItem = ({path, onDelete}: FolderProps) => {

    const linker = FolderLinkerService.getInstance();

    const t = useTranslation();

    const name = path.split("\\").at(-1);
    const color = useThemeColor("first-color");

    const variants: Variants = { 
        hover: {rotate: 22.5},
        tap: {rotate: 45}
    };

    const pending = useObservable(linker.isPending(path));
    const processing = useObservable(linker.isProcessing(path));
    const linkDisabled = pending || processing;

    const [linked, setLinked] = useState(false);

    useEffect(() => {
        loadFolderIsLinked();
    }, [path]);

    const loadFolderIsLinked = () => {
        linker.isFolderLinked(path).toPromise().then(setLinked);
    }

    const onClickLink = () => {
        if(linked){
            return linker.unlinkFolder(path).toPromise().then(loadFolderIsLinked);
        }
        return linker.linkFolder(path).toPromise().then(loadFolderIsLinked);
    }

    const cancelLink = () => { 
        linker.cancelFolder(path);
        loadFolderIsLinked();
    }

    return (
        <li className="w-full h-12 rounded-md shrink-0 flex flex-row items-center justify-between px-2 font-bold bg-light-main-color-1 dark:bg-main-color-1">
            <span className="cursor-help" title={path}>{name}</span>
            <div className="flex flex-row gap-1.5">
                <Tippy placement="left" content={t(`modals.shared-folders.buttons.${linked ? "unlink-folder" : "link-folder"}`)} arrow={false}>
                    <LinkButton variants={variants} linked={linked} disabled={linkDisabled} whileHover="hover" whileTap="tap" className="p-0.5 h-7 shrink-0 aspect-square blur-0 cursor-pointer hover:brightness-75" onClick={onClickLink}/>
                </Tippy>
                {!processing ? (
                    !pending ? (
                        <BsmButton className="aspect-square h-7 rounded-md p-1" icon={"trash"} withBar={false} onClick={e => {e.preventDefault(); onDelete?.()}}/>
                    ) : (
                        <BsmButton className="aspect-square h-7 rounded-md p-1" icon={"cross"} withBar={false} onClick={e => {e.preventDefault(); cancelLink()}}/>
                    )
                ) : (
                    <BsmBasicSpinner className="aspect-square h-7 rounded-md p-1 dark:bg-main-color-2" thikness="3.5px" style={{color}}/>
                )}
                
            </div>
        </li>
    )

}
