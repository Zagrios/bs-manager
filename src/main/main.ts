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

        // DeepLinkService.getInstance().dispatchLinkOpened("bsmanager://launch/?launchOptions=%7B%22debug%22%3Afalse%2C%22oculus%22%3Atrue%2C%22desktop%22%3Atrue%2C%22version%22%3A%7B%22BSVersion%22%3A%221.29.0%22%2C%22BSManifest%22%3A%223341527958186345367%22%2C%22ReleaseURL%22%3A%22https%3A%2F%2Fsteamcommunity.com%2Fgames%2F620980%2Fannouncements%2Fdetail%2F6169409105082976092%22%2C%22ReleaseImg%22%3A%22https%3A%2F%2Fcdn.cloudflare.steamstatic.com%2Fsteamcommunity%2Fpublic%2Fimages%2Fclans%2F%2F32055887%2F255fd49cd96042b97089f754609be291293e783f.png%22%2C%22ReleaseDate%22%3A%221680188760%22%2C%22year%22%3A%222023%22%2C%22name%22%3A%221.29.0+%281%29%22%7D%7D");
        
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
              color: '#6545ff af'
            },
            additionalArgs: [ '--nowait', '-omgargs' ]
          });
    
    }).catch(log.error);
}
