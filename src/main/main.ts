/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, protocol } from 'electron';
import log from 'electron-log';
import './ipcs';
import { UtilsService } from './services/utils.service';
import { WindowManagerService } from './services/window-manager.service';
import { DeepLinkService } from './services/deep-link.service';
import { AppWindow } from 'shared/models/window-manager/app-window.model';
import { LocalMapsManagerService } from './services/additional-content/local-maps-manager.service';
import { LocalPlaylistsManagerService } from './services/additional-content/local-playlists-manager.service';
import { LocalModelsManagerService } from './services/additional-content/local-models-manager.service';
import { APP_NAME } from './constants';

const isDebug = process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

log.transports.file.level = 'info';
log.transports.file.resolvePath = (() => {
    const now = new Date();
    return path.join(app.getPath("logs"), `${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}-v${app.getVersion()}.log`);
});

log.catchErrors();

const utilsService = UtilsService.getInstance();
utilsService.setAssetsPath(app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(__dirname, '../../assets'));

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
    const installer = require('electron-devtools-installer');
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ['REACT_DEVELOPER_TOOLS'];

    return installer.default(extensions.map((name) => installer[name]), forceDownload).catch(console.log);
};

const createWindow = async (window: AppWindow = "launcher.html") => {
    if(isDebug){ await installExtensions(); }
    WindowManagerService.getInstance().openWindow(window);
};

const initServicesMustBeInitialized = () => {
    LocalMapsManagerService.getInstance();
    LocalPlaylistsManagerService.getInstance();
    LocalModelsManagerService.getInstance();
    // Model
}

app.on('window-all-closed', () => {
    // Respect the OSX convention of having the application in memory even
    // after all windows have been closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

const gotTheLock = app.requestSingleInstanceLock();

if(!gotTheLock){
    app.quit();
}
else{

    app.on('second-instance', (e, argv) => {

        const deepLink = argv.find(arg => DeepLinkService.getInstance().isDeepLink(arg));

        if(!deepLink){ return; }

        DeepLinkService.getInstance().dispatchLinkOpened(deepLink);

    });

    app.whenReady().then(() => {

        app.setAppUserModelId(APP_NAME);

        initServicesMustBeInitialized();
        
        const deepLink = process.argv.find(arg => DeepLinkService.getInstance().isDeepLink(arg));

        if(!deepLink){
            createWindow();
        }
        else{
            DeepLinkService.getInstance().dispatchLinkOpened(deepLink);
        }

        protocol.registerFileProtocol('file', (request, callback) => {
            const pathname = decodeURI(request.url.replace('file:///', ''));
            callback(pathname);
        });

    }).catch(log.error);
}