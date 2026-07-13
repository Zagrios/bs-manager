import { app, BrowserWindow, BrowserWindowConstructorOptions, shell } from "electron";
import { resolveHtmlPath } from "../util";
import { UtilsService } from "./utils.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import path from "path";
import { APP_NAME } from "../constants";

export class WindowManagerService {
    private static instance: WindowManagerService;

    private readonly PRELOAD_PATH = app.isPackaged ? path.join(__dirname, "preload.js") : path.join(__dirname, "../../.erb/dll/preload.js");
    private readonly IS_DEBUG = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true"

    private readonly utilsService: UtilsService = UtilsService.getInstance();

    private readonly appWindowsOptions: Record<AppWindow, BrowserWindowConstructorOptions> = {
        "launcher.html": { width: 380, height: 500, minWidth: 380, minHeight: 500, resizable: false },
        "index.html": { width: 1080, height: 720, minWidth: 900, minHeight: 500 },
        "oneclick-download-map.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "oneclick-download-playlist.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "oneclick-download-model.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "shortcut-launch.html": { width: 600, height: 500, minWidth: 600, minHeight: 300, resizable: true },
    };

    private readonly baseWindowOption: BrowserWindowConstructorOptions = {
        title: APP_NAME,
        icon: process.platform === "linux"
            ? this.utilsService.getBuildPath(path.join("icons", "png", "256x256.png"))
            : this.utilsService.getBuildPath(path.join("icons", "win", "favicon.ico")),
        show: false,
        frame: false,
        titleBarOverlay: false,
        webPreferences: { preload: this.PRELOAD_PATH, webSecurity: !this.IS_DEBUG },
    };

    public static getInstance(): WindowManagerService {
        if (!WindowManagerService.instance) {
            WindowManagerService.instance = new WindowManagerService();
        }
        return WindowManagerService.instance;
    }

    private constructor() {}

    private isHttpUrl(url: string, httpsOnly = false): boolean {
        try {
            const { protocol } = new URL(url);
            return protocol === "https:" || (!httpsOnly && protocol === "http:");
        } catch {
            return false;
        }
    }

    private isAbsoluteUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    private handleNewWindow(url: string, window: BrowserWindow, isInternal: boolean){

        window.webContents.setWindowOpenHandler(({ url }) => {
            if(this.isHttpUrl(url)){
                shell.openExternal(url);
            }

            return { action: "deny"}
        });

        const handleNavigation = (event: { preventDefault: () => void }, navigationUrl: string) => {
            const isAllowed = isInternal
                ? navigationUrl.startsWith(resolveHtmlPath(""))
                : this.isHttpUrl(navigationUrl, true);

            if(isAllowed){ return; }

            event.preventDefault();
            if(this.isHttpUrl(navigationUrl)){
                shell.openExternal(navigationUrl);
            }
        };

        window.webContents.on("will-navigate", handleNavigation);
        window.webContents.on("will-redirect", handleNavigation);

        window.removeMenu();
        window.setMenu(null);

        const promise = window.loadURL(url);

        window.once("ready-to-show", () => {
            if (!window) {
                throw new Error('"window" is not defined');
            }
            window.show();
        });

        return promise.then(() => window);
    }

    public openWindow(url: AppWindow, options?: BrowserWindowConstructorOptions): Promise<BrowserWindow> {
        if(this.isAbsoluteUrl(url)){
            return Promise.reject(new Error("Remote URLs must be opened with openRemoteWindow"));
        }

        const windowType = url.split("?")[0];
        const window = new BrowserWindow({
            ...(this.appWindowsOptions[windowType] ?? {}),
            ...this.baseWindowOption,
            ...options,
            webPreferences: {
                ...this.baseWindowOption.webPreferences,
                ...options?.webPreferences,
                preload: this.PRELOAD_PATH,
            },
        });
        return this.handleNewWindow(resolveHtmlPath(url), window, true);
    }

    public openRemoteWindow(url: string, options?: BrowserWindowConstructorOptions): Promise<BrowserWindow> {
        if(!this.isHttpUrl(url, true)){
            return Promise.reject(new Error("Remote windows only support HTTPS URLs"));
        }

        const webPreferences = { ...options?.webPreferences };
        delete webPreferences.preload;

        const window = new BrowserWindow({
            ...this.baseWindowOption,
            ...options,
            webPreferences: {
                ...webPreferences,
                nodeIntegration: false,
                nodeIntegrationInWorker: false,
                nodeIntegrationInSubFrames: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                webviewTag: false,
            },
        });

        return this.handleNewWindow(url, window, false);
    }

    public closeAllWindows(except?: AppWindow) {
        BrowserWindow.getAllWindows().forEach(window => {
            if (except && window.webContents.getURL().includes(except)) { return; }
            window.close();
        });
    }

    public getWindows(window: AppWindow): BrowserWindow[] {
        return BrowserWindow.getAllWindows().filter(w => w.webContents.getURL().includes(window));
    }

    public openWindowOrFocus(window: AppWindow): Promise<void> {

        const win = this.getWindows(window);

        if (win.length) {
            win[0].focus();
            return Promise.resolve();
        }

        return this.openWindow(window).then(() => {});
    }
}
