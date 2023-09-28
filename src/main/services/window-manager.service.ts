import { app, BrowserWindow, BrowserWindowConstructorOptions, shell, WebContents } from "electron";
import { resolveHtmlPath } from "../util";
import { UtilsService } from "./utils.service";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import path from "path";
import { APP_NAME } from "../constants";
import { isValidUrl } from "../../shared/helpers/url.helpers";

export class WindowManagerService {
    private static instance: WindowManagerService;

    private readonly PRELOAD_PATH = app.isPackaged ? path.join(__dirname, "preload.js") : path.join(__dirname, "../../../.erb/dll/preload.js");
    private readonly IS_DEBUG = process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true"

    private readonly utilsService: UtilsService = UtilsService.getInstance();

    private readonly appWindowsOptions: Record<AppWindow, BrowserWindowConstructorOptions> = {
        "launcher.html": { width: 380, height: 500, minWidth: 380, minHeight: 500, resizable: false },
        "index.html": { width: 1080, height: 720, minWidth: 900, minHeight: 500 },
        "oneclick-download-map.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "oneclick-download-playlist.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "oneclick-download-model.html": { width: 350, height: 400, minWidth: 350, minHeight: 400, resizable: false },
        "shortcut-launch.html": { width: 600, height: 300, minWidth: 600, minHeight: 300, resizable: false },
    };

    private readonly baseWindowOption: BrowserWindowConstructorOptions = {
        title: APP_NAME,
        icon: this.utilsService.getAssetsPath("favicon.ico"),
        show: false,
        frame: false,
        titleBarOverlay: false,
        webPreferences: { preload: this.PRELOAD_PATH, webSecurity: !this.IS_DEBUG },
    };

    private readonly windows = new Map<string, BrowserWindow>();

    public static getInstance(): WindowManagerService {
        if (!WindowManagerService.instance) {
            WindowManagerService.instance = new WindowManagerService();
        }
        return WindowManagerService.instance;
    }

    private constructor() {}

    private handleNewWindow(url: AppWindow, window: BrowserWindow){

        window.webContents.setWindowOpenHandler(({ url }) => {
            if(isValidUrl(url)){
                shell.openExternal(url);
            }
            
            return { action: "deny"}
        });

        window.removeMenu();
        window.setMenu(null);

        const promise = window.loadURL(isValidUrl(url) ? url : resolveHtmlPath(url));

        window.once("ready-to-show", () => {
            if (!window) {
                throw new Error('"window" is not defined');
            }
            window.show();
        });

        window.once("closed", () => {
            this.windows.delete(url);
            if (!this.windows.size) {
                app.quit();
            }
        });

        this.windows.set(url, window);
        this.utilsService.setMainWindows(this.windows as Map<AppWindow, BrowserWindow>); // TODO : remove


        return promise.then(() => window);
    }

    public openWindow(windowType: AppWindow, options?: BrowserWindowConstructorOptions): Promise<BrowserWindow> {
        const window = new BrowserWindow({ ...(this.appWindowsOptions[windowType] ?? {}), ...this.baseWindowOption, ...options });
        return this.handleNewWindow(windowType, window);
    }

    public closeAllWindows(except?: AppWindow) {
        this.windows.forEach((window, key) => {
            if (key === except) {
                return;
            }
            window.close();
        });
    }

    public close(...win: AppWindow[]) {
        win.forEach(window => {
            this.windows.get(window)?.close();
        });
    }

    public getWindow(window: AppWindow): BrowserWindow {
        return this.windows.get(window);
    }

    public getAppWindowFromWebContents(sender: WebContents): AppWindow {
        return Array.from(this.windows.entries()).find(([, value]) => value.webContents.id === sender.id)[0];
    }

    public openWindowOrFocus(window: AppWindow): Promise<void> {
        const win = this.getWindow(window);
        
        if (win) {
            win.focus();
            return Promise.resolve();
        }

        return this.openWindow(window).then(() => {});
    }
}
