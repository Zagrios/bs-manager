import { app, BrowserWindow, BrowserWindowConstructorOptions } from "electron";
import { resolveHtmlPath } from "../util";
import { UtilsService } from "./utils.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import path from "path";
import { APP_NAME } from "../constants";

export class WindowManagerService{

    private static instance: WindowManagerService;

    private readonly PRELOAD_PATH = app.isPackaged ? path.join(__dirname, 'preload.js') : path.join(__dirname, '../../../.erb/dll/preload.js')

    private readonly utilsService: UtilsService = UtilsService.getInstance();

    private readonly appWindowsOptions: Record<AppWindow, BrowserWindowConstructorOptions> = {
        "launcher.html": {width: 380, height: 500, minWidth: 380, minHeight: 500, resizable: false},
        "index.html": {width: 1080, height: 720, minWidth: 900, minHeight: 500},
        "oneclick-download-map.html": {width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false},
        "oneclick-download-playlist.html": {width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false},
        "oneclick-download-model.html": {width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false},
    }

    private readonly baseWindowOption: BrowserWindowConstructorOptions = {
        title: APP_NAME,
        icon: this.utilsService.getAssetsPath("favicon.ico"),
        show: false,
        frame: false,
        titleBarOverlay: false,
        webPreferences: { preload: this.PRELOAD_PATH, webSecurity: false }
    }

    private readonly windows: Map<AppWindow, BrowserWindow> = new Map<AppWindow, BrowserWindow>();

    public static getInstance(): WindowManagerService{
        if(!WindowManagerService.instance){ WindowManagerService.instance = new WindowManagerService(); }
        return WindowManagerService.instance;
    }

    private constructor(){}

    public openWindow(windowType: AppWindow, options?: BrowserWindowConstructorOptions): Promise<BrowserWindow>{
        const window = new BrowserWindow({...this.appWindowsOptions[windowType], ...this.baseWindowOption, ...options});

        const promise = window.loadURL(resolveHtmlPath(windowType));
        window.removeMenu();
        window.setMenu(null);

        window.once("ready-to-show", () => {
            if (!window) { throw new Error('"window" is not defined'); }
            window.show();
        });

        window.once("closed", () => {
            this.windows.delete(windowType);
            if(!this.windows.size){ app.quit(); }
        });

        this.windows.set(windowType, window);
        this.utilsService.setMainWindows(this.windows);

        return promise.then(() => window);
    }

    public closeAllWindows(except?: AppWindow){
        this.windows.forEach((window, key) => {
            if(key === except){ return; }
            window.close();
        })
    }

    public close(...win: AppWindow[]){
        win.forEach(window => {
            this.windows.get(window)?.close();
        });
    }

    public getWindow(window: AppWindow): BrowserWindow{
        return this.windows.get(window);
    }

    public getAppWindowFromWebContents(sender: Electron.WebContents): AppWindow{
        return Array.from(this.windows.entries()).find(([key, value]) => value.webContents.id === sender.id)[0];
    }

}