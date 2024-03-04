import path from "path";
import { app } from "electron";
import ElectronStore from "electron-store";
import { copyDirectoryWithJunctions, deleteFolder, ensureFolderExist, pathExist } from "../helpers/fs.helpers";
import { tryit } from "../../shared/helpers/error.helpers";
import { pathExistsSync } from "fs-extra";

export class InstallationLocationService {
    private static instance: InstallationLocationService;

    public static getInstance(): InstallationLocationService {
        if (!InstallationLocationService.instance) {
            InstallationLocationService.instance = new InstallationLocationService();
        }
        return InstallationLocationService.instance;
    }

    public readonly INSTALLATION_FOLDER = "BSManager";
    public readonly VERSIONS_FOLDER = "BSInstances";

    private readonly SHARED_CONTENT_FOLDER = "SharedContent";

    private readonly STORE_INSTALLATION_PATH_KEY = "installation-folder";

    private readonly installPathConfig: ElectronStore;
    private readonly updateListeners: Set<Listener> = new Set();

    private _installationDirectory: string;

    private constructor() {
        this.installPathConfig = new ElectronStore({ watch: true });

        this.installPathConfig.onDidChange(this.STORE_INSTALLATION_PATH_KEY, () => {
            this.triggerListeners();
        });
    }

    private triggerListeners(): void {
        this.updateListeners.forEach(listener => listener());
    }

    public async setInstallationDirectory(newDir: string): Promise<string> {
        newDir = path.basename(newDir) === this.INSTALLATION_FOLDER ? path.join(newDir, "..") : newDir;
        const oldDir = await this.installationDirectory();

        await ensureFolderExist(oldDir);
        await copyDirectoryWithJunctions(oldDir, path.join(newDir, this.INSTALLATION_FOLDER), { overwrite: true });

        this._installationDirectory = newDir;
        this.installPathConfig.set(this.STORE_INSTALLATION_PATH_KEY, newDir);

        deleteFolder(oldDir);

        return this.installationDirectory();
    }

    public onInstallLocationUpdate(fn: Listener) {
        this.updateListeners.add(fn);
    }

    public async installationDirectory(): Promise<string> {

        const installParentPath = async () => {
            if(this._installationDirectory) {
                return this._installationDirectory;
            }

            if(this.installPathConfig.has(this.STORE_INSTALLATION_PATH_KEY)) {
                return this.installPathConfig.get(this.STORE_INSTALLATION_PATH_KEY) as string;
            }

            const { result: oldPath } = tryit(() => path.join(app.getPath("documents"), this.INSTALLATION_FOLDER));
            if(oldPath && pathExistsSync(oldPath)){
                return app.getPath("documents");
            }

            return app.getPath("home");
        };

        this._installationDirectory = await installParentPath();

        return path.join(this._installationDirectory, this.INSTALLATION_FOLDER);
    }

    public async versionsDirectory(): Promise<string> {
        return path.join(await this.installationDirectory(), this.VERSIONS_FOLDER);
    }

    public async sharedContentPath(): Promise<string> {
        return path.join(await this.installationDirectory(), this.SHARED_CONTENT_FOLDER);
    }
}

type Listener = () => void;
