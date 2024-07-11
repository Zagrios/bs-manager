/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from "path";
import { app, ipcMain } from "electron";
import log from "electron-log";
import "./ipcs";
import { WindowManagerService } from "./services/window-manager.service";
import { DeepLinkService } from "./services/deep-link.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { LocalMapsManagerService } from "./services/additional-content/maps/local-maps-manager.service";
import { LocalPlaylistsManagerService } from "./services/additional-content/local-playlists-manager.service";
import { LocalModelsManagerService } from "./services/additional-content/local-models-manager.service";
import { APP_NAME } from "./constants";
import { BSLauncherService } from "./services/bs-launcher/bs-launcher.service";
import { IpcRequest } from "shared/models/ipc";
import { LivShortcut } from "./services/liv/liv-shortcut.service";
import { SteamLauncherService } from "./services/bs-launcher/steam-launcher.service";
import { FileAssociationService } from "./services/file-association.service";
import { SongDetailsCacheService } from "./services/additional-content/maps/song-details-cache.service";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

log.transports.file.level = "info";
log.transports.file.resolvePath = () => {
    const now = new Date();
    return path.join(app.getPath("logs"), `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-v${app.getVersion()}.log`);
};

log.catchErrors();

if (process.env.NODE_ENV === "production") {
    const sourceMapSupport = require("source-map-support");
    sourceMapSupport.install();
}

if (isDebug) {
    require("electron-debug")();
}

const installExtensions = async () => {
    const installer = require("electron-devtools-installer");
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ["REACT_DEVELOPER_TOOLS"];

    return installer
        .default(
            extensions.map(name => installer[name]),
            forceDownload
        )
        .catch(log.error);
};

const createWindow = async (window: AppWindow = "launcher.html") => {
    if (isDebug) {
        await installExtensions();
    }
    WindowManagerService.getInstance().openWindow(window);
};

const initServicesMustBeInitialized = () => {
    LocalMapsManagerService.getInstance();
    LocalPlaylistsManagerService.getInstance();
    LocalModelsManagerService.getInstance();
    LivShortcut.getInstance();
    BSLauncherService.getInstance();
    SongDetailsCacheService.getInstance();
}

const findDeepLinkInArgs = (args: string[]): string => {
    return args.find(arg => DeepLinkService.getInstance().isDeepLink(arg));
}

const findAssociatedFileInArgs = (args: string[]): string => {
    return args.find(arg => FileAssociationService.getInstance().isFileAssociated(arg));
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", (_, argv) => {
        const deepLink = findDeepLinkInArgs(argv);
        const associatedFile = findAssociatedFileInArgs(argv);

        if (deepLink) {
            DeepLinkService.getInstance().dispatchLinkOpened(deepLink);
        } else if (associatedFile) {
            FileAssociationService.getInstance().handleFileAssociation(associatedFile);
        }

    });

    app.on("window-all-closed", () => {
        if (process.platform === "darwin") { return; }
        app.quit();
    })

    app.whenReady().then(() => {

        // C:\\Users\\Mathieu\\Desktop\\BSManager\\BSInstances\\My Version\\UserData\\SongDetailsCache.proto

        app.setAppUserModelId(APP_NAME);

        initServicesMustBeInitialized();

        const deepLink = findDeepLinkInArgs(process.argv);
        const associatedFile = findAssociatedFileInArgs(process.argv);

        if (deepLink) {
            DeepLinkService.getInstance().dispatchLinkOpened(deepLink);
        } else if (associatedFile) {
            FileAssociationService.getInstance().handleFileAssociation(associatedFile);
        } else {
            createWindow();
        }

        SteamLauncherService.getInstance().restoreSteamVR();

        // Log renderer errors
        ipcMain.on("log-error", (_, args: IpcRequest<unknown>) => {
            log.error(args?.args);
        });

    }).catch(log.error);
}
