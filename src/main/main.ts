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
import { readdirSync, statSync, unlinkSync } from "fs-extra";
import { StaticConfigurationService } from "./services/static-configuration.service";

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";
const staticConfig = StaticConfigurationService.getInstance();

export const filterStrings = new Set<string>();
export const filterPatterns = new Set<RegExp>();

// Filter all occulus tokens
filterPatterns.add(/FRL\S{10,}/g);

initLogger();
deleteOlestLogs();
deleteOldLogs();

staticConfig.take("disable-hadware-acceleration", disabled => {
    if(disabled === true){ // strictly check for true
        log.info("Disabling hardware acceleration");
        app.disableHardwareAcceleration();
    }
});


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

        ipcMain.on("add-filter-string", (_, args: IpcRequest<string>) => {
            filterStrings.add(args?.args);
        });

        ipcMain.on("add-filter-pattern", (_, args: IpcRequest<string>) => {
            filterPatterns.add(new RegExp(args?.args));
        });

    }).catch(log.error);
}

function initLogger(){
    log.transports.file.level = "info";
    log.transports.file.resolvePath = () => {
        const now = new Date();
        return path.join(app.getPath("logs"), `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-v${app.getVersion()}.log`);
    };

    log.hooks.push((message) => {

        const filterMessage = (filter: string|RegExp, ...param: unknown[]): unknown[] => {
            return param.map(data => {

                if(typeof data === "string"){
                    return data.replaceAll(filter, "****");
                }

                if(data instanceof Error){
                    data.message = data.message?.replaceAll(filter, "****");
                    data.stack = data.stack?.replaceAll(filter, "****");
                }

                if(data instanceof Array){
                    return filterMessage(filter, ...data);
                }

                return data;
            });
        }

        filterStrings.forEach(filter => {
            if(filter && message.data.length){
                message.data = filterMessage(filter, ...message.data);
            }
        });

        filterPatterns.forEach(filter => {
            if(filter && message.data.length){
                message.data = filterMessage(filter, ...message.data);
            }
        });

        return message;
    });

    log.catchErrors();
}

function getLogFilesEntries() {
    try {
        const logsFolder = app.getPath("logs");
        let logs = readdirSync(logsFolder, { withFileTypes: true });

        logs = logs.filter(file => file.isFile() && path.extname(file.name) === ".log");

        logs.sort((a, b) => {
            const aStat = statSync(path.join(logsFolder, a.name));
            const bStat = statSync(path.join(logsFolder, b.name));
            return bStat.mtime.getTime() - aStat.mtime.getTime();
        });

        return logs.map(file => {
            const filePath = path.join(logsFolder, file.name);
            const stat = statSync(filePath);
            return {
                path: filePath,
                name: file.name,
                stats: stat
            };
        });
    } catch (err) {
        log.error('Error while retrieving log files entries:', err);
        return [];
    }
}

// keep only the last 5 logs
function deleteOldLogs(): void{
    try {
        let logs = getLogFilesEntries();

        logs = logs.slice(5);

        logs.forEach(file => {
            try {
                unlinkSync(file.path);
                log.info(`Deleted log file: ${file.path}`);
            } catch (err) {
                log.error(`Error deleting file ${file.path}:`, err);
            }
        });
    } catch (err) {
        log.error("Error while deleting old logs:", err);
    }
}

// Temporary function to delete logs before 2024-07-31
function deleteOlestLogs(): void{
    // delete all logs before 2024-07-31
    const date = new Date(2024, 6, 31); // month is 0-based
    const logs = getLogFilesEntries().filter(file => file.stats.mtime.getTime() < date.getTime());

    logs.forEach(file => {
        try {
            unlinkSync(file.path);
            log.info(`Deleted log file: ${file.path}`);
        } catch (err) {
            log.error(`Error deleting file ${file.path}:`, err);
        }
    });
}
