import { AppWindow } from "shared/models/window-manager/app-window.model";
import { IpcService } from "./ipc.service";
import { lastValueFrom } from "rxjs";

export class WindowManagerService {
    private static instance: WindowManagerService;

    private readonly ipcService: IpcService;

    public static getInstance(): WindowManagerService {
        if (!WindowManagerService.instance) {
            WindowManagerService.instance = new WindowManagerService();
        }
        return WindowManagerService.instance;
    }

    private constructor() {
        this.ipcService = IpcService.getInstance();
    }

    public openThenCloseAll(window: AppWindow): Promise<void> {
        return lastValueFrom(this.ipcService.sendV2("open-window-then-close-all", window));
    }

    public openWindowOrFocus(window: AppWindow): Promise<void> {
        return lastValueFrom(this.ipcService.sendV2("open-window-or-focus", window));
    }

}
