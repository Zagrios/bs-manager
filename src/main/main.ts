/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from "path";
import { app, ipcMain, protocol } from "electron";
import log from "electron-log";
import "./ipcs";
import { WindowManagerService } from "./services/window-manager.service";
import { DeepLinkService } from "./services/deep-link.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { LocalMapsManagerService } from "./services/additional-content/local-maps-manager.service";
import { LocalPlaylistsManagerService } from "./services/additional-content/local-playlists-manager.service";
import { LocalModelsManagerService } from "./services/additional-content/local-models-manager.service";
import { APP_NAME } from "./constants";
import { BSLauncherService } from "./services/bs-launcher.service";
import { IpcRequest } from "shared/models/ipc";

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
        .catch(console.error);
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

    BSLauncherService.getInstance();
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on("second-instance", (e, argv) => {
        const deepLink = argv.find(arg => DeepLinkService.getInstance().isDeepLink(arg));

        if (!deepLink) {
            return;
        }

        DeepLinkService.getInstance().dispatchLinkOpened(deepLink);
    });

    app.whenReady().then(() => {
        
        app.setAppUserModelId(APP_NAME);

        initServicesMustBeInitialized();

        // TODO : to remove
        setTimeout(() => {
            // DeepLinkService.getInstance().dispatchLinkOpened("bsmanager://launch?version=1.29.1&versionName=Hi+Twitter&versionIno=2533274792493431&oculusMode=true&desktopMode=true&additionalArgs=--nowait&additionalArgs=-omgargs");
        }, 3000);

        
        const deepLink = process.argv.find(arg => DeepLinkService.getInstance().isDeepLink(arg));

        if (!deepLink) {
            createWindow();
        } else {
            DeepLinkService.getInstance().dispatchLinkOpened(deepLink);
        }
        
        protocol.registerFileProtocol("file", (request, callback) => {
            const pathname = decodeURI(request.url.replace("file:///", ""));
            callback(pathname);
        });
        
        BSLauncherService.getInstance().restoreSteamVR();
        
        // Log renderer errors
        ipcMain.on("log-error", (event, args: IpcRequest<any>) => {
            log.error(args?.args);
        });

        // TODO : remove this
        BSLauncherService.getInstance().createLaunchShortcut({
            debug: false,
            oculus: true,
            desktop: true,
            version: {
              BSVersion: '1.29.1',
              BSManifest: '886973241045584398',
              ReleaseURL: 'https://steamcommunity.com/games/620980/announcements/detail/6169409105101272202',
              ReleaseImg: 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images/clans/32055887/c328e407367e9914abaf92f609501877ee5abb63.png',
              ReleaseDate: '1680623885',
              year: '2023',
              name: 'Hi Twitter',
              ino: 2533274792493431,
              color: '#6545ff'
            },
            additionalArgs: [ '--nowait', '-omgargs' ]
          });
    
    }).catch(log.error);
}
