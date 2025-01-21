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
import { Dirent, readdirSync, rmSync, unlinkSync } from "fs-extra";
import { StaticConfigurationService } from "./services/static-configuration.service";
import { configureProxy } from './helpers/proxy.helpers';

const isDebug = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";
const staticConfig = StaticConfigurationService.getInstance();

export const filterStrings = new Set<string>();
export const filterPatterns = new Set<RegExp>();

// Filter all occulus tokens
filterPatterns.add(/(FRL|OC)\S{10,}/g);

initLogger();
deleteOldestLogs();
deleteOldLogs();

staticConfig.take("disable-hadware-acceleration", disabled => {
    if(disabled === true){ // strictly check for true
        log.info("Disabling hardware acceleration");
        app.disableHardwareAcceleration();
    }
});

configureProxy();

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

const createWindow = async (window: AppWindow) => {
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
            createWindow(process.platform === "linux"
                ? "index.html" : "launcher.html"
            );
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

function convertDateToDateString(date: Date): string {
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function initLogger(){
    log.transports.file.level = "info";

    let filepath = "";
    let currentDateString = convertDateToDateString(new Date());
    log.transports.file.resolvePath = () => {
        const now = new Date();
        const nowString = convertDateToDateString(now);
        if (filepath && nowString === currentDateString) {
            return filepath;
        }

        filepath = path.join(
            app.getPath("logs"), nowString,
            `${now.getTime()}-v${app.getVersion()}.log`
        );
        currentDateString = nowString;
        return filepath;
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

// Keep only the past week (7 days) of logs
function deleteOldLogs(): void {
    const deleteLogFolders: Dirent[] = [];
    try {
        const filterDate = convertDateToDateString(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days
        );
        deleteLogFolders.push.apply([],
            readdirSync(app.getPath("logs"), { withFileTypes: true })
                .filter(folder => folder.isDirectory() && folder.name <= filterDate)
        );
    } catch (error) {
        log.error("Error while deleting old logs:", error);
        return;
    }

    for (const folder of deleteLogFolders) {
        const folderPath = path.join(folder.parentPath, folder.name);
        try {
            rmSync(folderPath, { recursive: true, force: true });
            log.info("Deleted log folder:", folderPath);
        } catch (error) {
            log.error("Error deleting folder:", folderPath, error);
        }
    }
}

// Obsolete behavior, delete log files that are on the parent log folder
function deleteOldestLogs(): void {
    const logsFolder = app.getPath("logs");
    const logs = readdirSync(logsFolder, { withFileTypes: true })
        .filter(file => file.isFile() && path.extname(file.name) === ".log");

    for (const file of logs) {
        const filepath = path.join(file.parentPath, file.name);
        try {
            unlinkSync(filepath);
            log.info("Deleted log file:", filepath);
        } catch (error) {
            log.error("Error deleting file:", filepath, error);
        }
    }
}

export function addFilterStringLog(filter: string): void {
    filterStrings.add(filter);
}

export function addFilterPatternLog(filter: RegExp): void {
    filterPatterns.add(filter);
}
