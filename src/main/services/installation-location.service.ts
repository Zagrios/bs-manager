import path from "path";
import { app } from "electron";
import ElectronStore from "electron-store";
import { copyDirectoryWithJunctions, deleteFolder, ensureFolderExist } from "../helpers/fs.helpers";

export class InstallationLocationService {
    private static instance: InstallationLocationService;

    public static getInstance(): InstallationLocationService {
        if (!InstallationLocationService.instance) {
            InstallationLocationService.instance = new InstallationLocationService();
        }
        return InstallationLocationService.instance;
    }

    private readonly INSTALLATION_FOLDER = "BSManager";
    private readonly VERSIONS_FOLDER = "BSInstances";

    private readonly SHARED_CONTENT_FOLDER = "SharedContent";

    private readonly STORE_INSTALLATION_PATH_KEY = "installation-folder";

    private readonly installPathConfig: ElectronStore;
    private readonly updateListeners: Set<Listener> = new Set();

    private _installationDirectory: string;

    private constructor() {
        this.installPathConfig = new ElectronStore({ watch: true });
        this.initInstallationLocation();

        this.installPathConfig.onDidChange(this.STORE_INSTALLATION_PATH_KEY, () => {
            this.triggerListeners();
        });
    }

    private initInstallationLocation(): void {
        this._installationDirectory = (this.installPathConfig.get<string>(this.STORE_INSTALLATION_PATH_KEY) as string) || app.getPath("documents");
    }

    private triggerListeners(): void {
        this.updateListeners.forEach(listener => listener());
    }

    public async setInstallationDirectory(newDir: string): Promise<string> {
        const oldDir = this.installationDirectory;
        const newDest = path.join(newDir, this.INSTALLATION_FOLDER);

        await ensureFolderExist(oldDir);

        await copyDirectoryWithJunctions(oldDir, newDest, { overwrite: true });

        this._installationDirectory = newDir;
        this.installPathConfig.set(this.STORE_INSTALLATION_PATH_KEY, newDir);

        deleteFolder(oldDir);

        return this.installationDirectory;
    }

    public onInstallLocationUpdate(fn: Listener) {
        this.updateListeners.add(fn);
    }

    public get installationDirectory(): string {
        return path.join(this._installationDirectory, this.INSTALLATION_FOLDER);
    }

    public get versionsDirectory(): string {
        return path.join(this.installationDirectory, this.VERSIONS_FOLDER);
    }

    public get sharedContentPath(): string {
        return path.join(this.installationDirectory, this.SHARED_CONTENT_FOLDER);
    }
}

type Listener = () => void;
