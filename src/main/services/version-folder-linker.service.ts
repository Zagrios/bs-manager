import { getFoldersInFolder, pathExist } from "../helpers/fs.helpers";
import path from "path";
import { VersionLinkerAction, VersionLinkFolderAction, VersionUnlinkFolderAction } from "renderer/services/version-folder-linker.service";
import { BSVersion } from "shared/bs-version.interface";
import { LocalMapsManagerService } from "./additional-content/local-maps-manager.service";
import { BSLocalVersionService } from "./bs-local-version.service";
import { FolderLinkerService, LinkOptions } from "./folder-linker.service";

export class VersionFolderLinkerService {

    private static instance: VersionFolderLinkerService;

    public static getInstance(): VersionFolderLinkerService{
        if(!VersionFolderLinkerService.instance){ VersionFolderLinkerService.instance = new VersionFolderLinkerService() }
        return VersionFolderLinkerService.instance;
    }

    private readonly localVersion: BSLocalVersionService;
    private readonly folderLinker: FolderLinkerService;

    private constructor(){
        this.localVersion = BSLocalVersionService.getInstance();
        this.folderLinker = FolderLinkerService.getInstance();
    }

    private specialFolderOption(relativeFolder: string, options: LinkOptions): LinkOptions{
        if(relativeFolder.includes(LocalMapsManagerService.CUSTOM_LEVELS_FOLDER)){
            return {...options, intermediateFolder: LocalMapsManagerService.SHARED_MAPS_FOLDER};
        }

        if(relativeFolder.includes("UserData")){
            return { ...options, backup: true };
        }

        return options ?? {};
    }

    private async isOtherVersionHaveFolderLinked(relativeFolder: string, ignorePath: string): Promise<boolean>{
        const versions = await this.localVersion.getInstalledVersions();
        const versionPaths = (await Promise.allSettled(versions.map(version => this.localVersion.getVersionPath(version)))).reduce((acc, res) => {
            if(res.status === "fulfilled"){
                acc.push(res.value);
            }
            return acc;
        }, [] as string[]);

        for(const versionPath of versionPaths){
            const folderPath = this.relativeToFullPath(versionPath, relativeFolder);
            if(folderPath === ignorePath){ continue; }
            if(await this.folderLinker.isFolderSymlink(folderPath)){ console.log(folderPath); return true; }
        }

        return false;
    }

    private relativeToFullPath(parentPath: string, relativePath: string): string{
        return path.join(parentPath, relativePath);
    }


    public async linkVersionFolder(action: VersionLinkerAction): Promise<boolean>{
        action.options = this.specialFolderOption(action.relativeFolder, action.options);
        const versionPath = await this.localVersion.getVersionPath(action.version);
        const folderPath = this.relativeToFullPath(versionPath, action.relativeFolder);
        return this.folderLinker.linkFolder(folderPath, action.options).catch(() => false).then(() => true)
    }

    public async unlinkVersionFolder(action: VersionUnlinkFolderAction): Promise<boolean>{
        action.options = this.specialFolderOption(action.relativeFolder, action.options);

        const versionPath = await this.localVersion.getVersionPath(action.version);
        const folderPath = this.relativeToFullPath(versionPath, action.relativeFolder);

        action.options.moveContents = !(await this.isOtherVersionHaveFolderLinked(action.relativeFolder, folderPath));

        return this.folderLinker.unlinkFolder(folderPath, action.options).catch(() => false).then(() => true);
    }

    public async doAction(action: VersionLinkerAction): Promise<boolean>{
        if(action.type === "link"){
            return this.linkVersionFolder(action);
        }
        return this.unlinkVersionFolder(action as VersionUnlinkFolderAction);
    }

    public async isFolderLinked(version: BSVersion, relativeFolder: string): Promise<boolean>{
        const versionPath = await this.localVersion.getVersionPath(version);
        const folderPath = this.relativeToFullPath(versionPath, relativeFolder);
        return this.folderLinker.isFolderSymlink(folderPath);
    }

    public async getLinkedFolders(version: BSVersion, options?: { relative?: boolean }): Promise<string[]>{
        const versionPath = await this.localVersion.getVersionPath(version);
        const [rootFolders, beatSaberDataFolders] = await Promise.all([
            getFoldersInFolder(versionPath),
            getFoldersInFolder(path.join(versionPath, "Beat Saber_Data"))
        ]);

        const linkedFolder = await Promise.all([...rootFolders, ...beatSaberDataFolders].map(async folder => {
            if(!(await this.folderLinker.isFolderSymlink(folder))){ return null; }
            return folder;   
        }));

        if(options?.relative){
            return linkedFolder.filter(folder => folder).map(folder => path.relative(versionPath, folder));
        }

        return linkedFolder.filter(folder => folder);
    }

}