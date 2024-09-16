import { InstallationLocationService } from "./installation-location.service";
import log from "electron-log";
import { deleteFolder, ensureFolderExist, moveFolderContent, pathExist, unlinkPath } from "../helpers/fs.helpers";
import { lstat, symlink } from "fs/promises";
import path from "path";
import { copy, readlink } from "fs-extra";
import { lastValueFrom } from "rxjs";
import { noop } from "shared/helpers/function.helpers";
import { StaticConfigurationService } from "./static-configuration.service";

export class FolderLinkerService {
    private static instance: FolderLinkerService;

    public static getInstance(): FolderLinkerService {
        if (!FolderLinkerService.instance) {
            FolderLinkerService.instance = new FolderLinkerService();
        }
        return FolderLinkerService.instance;
    }

    private readonly installLocationService = InstallationLocationService.getInstance();
    private readonly staticConfig: StaticConfigurationService;

    private linkingType: "junction" | "symlink" = "junction";

    private constructor() {
        this.installLocationService = InstallationLocationService.getInstance();
        this.staticConfig = StaticConfigurationService.getInstance();

        this.linkingType = this.staticConfig.get("use-symlinks") === true ? "symlink" : "junction";
        log.info(`Linking type is set to ${this.linkingType}`);

        this.staticConfig.$watch("use-symlinks").subscribe((useSymlink) => {
            this.linkingType = useSymlink === true ? "symlink" : "junction";
            log.info(`Linking type set to ${this.linkingType}`);
        });
    }

    private async sharedFolder(): Promise<string> {
        return this.installLocationService.sharedContentPath();
    }

    private async getSharedFolder(folderPath: string, intermediateFolder?: string): Promise<string> {
        return path.join(await this.sharedFolder(), intermediateFolder ?? "", path.basename(folderPath));
    }

    private getBackupFolder(folderPath: string): string {
        return `${folderPath}_backup`;
    }

    private async backupFolder(folderPath: string): Promise<void> {
        if (!(await pathExist(folderPath))) {
            return;
        }
        return copy(folderPath, this.getBackupFolder(folderPath), { overwrite: true, errorOnExist: false });
    }

    private async restoreFolder(folderPath: string): Promise<void> {
        if (!(await pathExist(this.getBackupFolder(folderPath)))) {
            return;
        }
        return copy(this.getBackupFolder(folderPath), folderPath, { overwrite: true, errorOnExist: false }).then(() => {
            return deleteFolder(this.getBackupFolder(folderPath));
        });
    }

    private getLinkingType(): "junction" | undefined {
        return this.linkingType === "junction" ? "junction" : undefined;
    }

    public async linkFolder(folderPath: string, options?: LinkOptions): Promise<void> {
        const sharedPath = await this.getSharedFolder(folderPath, options?.intermediateFolder);

        if (await this.isFolderSymlink(folderPath)) {
            const isTargetedToSharedPath = await readlink(folderPath)
                .then(target => target === sharedPath)
                .catch(() => false);
            if (isTargetedToSharedPath) {
                return;
            }
            await unlinkPath(folderPath);

            log.info(`Linking ${folderPath} to ${sharedPath}; type: ${this.linkingType}`);
            return symlink(sharedPath, folderPath, this.getLinkingType());
        }

        await ensureFolderExist(sharedPath);

        if (options?.backup === true) {
            await this.backupFolder(folderPath);
        }

        await ensureFolderExist(folderPath);

        if (options?.keepContents !== false) {
            await lastValueFrom(moveFolderContent(folderPath, sharedPath, { overwrite: true }));
        }

        await deleteFolder(folderPath);

        log.info(`Linking ${folderPath} to ${sharedPath}; type: ${this.linkingType}`);
        return symlink(sharedPath, folderPath, this.getLinkingType());
    }

    public async unlinkFolder(folderPath: string, options?: UnlinkOptions): Promise<void> {
        if (!(await this.isFolderSymlink(folderPath))) {
            return;
        }
        await unlinkPath(folderPath);

        const sharedPath = await this.getSharedFolder(folderPath, options?.intermediateFolder);

        await ensureFolderExist(folderPath);

        if (options?.backup === true) {
            return this.restoreFolder(folderPath);
        }

        if (options.moveContents === true) {
            return lastValueFrom(moveFolderContent(sharedPath, folderPath, { overwrite: true })).then(noop);
        }

        if (options?.keepContents === false) {
            return;
        }

        await ensureFolderExist(sharedPath);

        return copy(sharedPath, folderPath, { errorOnExist: false, recursive: true });
    }

    public async isFolderSymlink(folder: string): Promise<boolean> {
        try {
            if (!(await pathExist(folder))) {
                return false;
            }
            return await lstat(folder).then(stat => stat.isSymbolicLink());
        } catch (e) {
            log.error(e);
        }
        return false;
    }
}

export interface LinkOptions {
    keepContents?: boolean;
    intermediateFolder?: string;
    backup?: boolean;
}

export interface UnlinkOptions extends LinkOptions {
    moveContents?: boolean;
}
