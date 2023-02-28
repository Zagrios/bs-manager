import { IpcResponse, IpcRequest } from "shared/models/ipc";
import { ipcMain } from "electron";
import { Observable } from "rxjs";
import { IpcChannel, IpcCompleteChannel, IpcErrorChannel } from "shared/models/ipc/ipc-response.interface";
import { AppWindow } from "shared/models/window-manager/app-window.model";
import { WindowManagerService } from "./window-manager.service";
import { IpcReplier } from "shared/models/ipc/ipc-request.interface";

export class IpcService {

    private static instance: IpcService;

    public static getInstance(): IpcService {
        if (!IpcService.instance) { IpcService.instance = new IpcService(); }
        return IpcService.instance;
    }

    private readonly windows: WindowManagerService;

    private constructor() {
        this.windows = WindowManagerService.getInstance();
    }

    private getErrorChannel(channel: IpcChannel): IpcErrorChannel {
        return `${channel}_error`;
    }

    private getCompleteChannel(channel: IpcChannel): IpcCompleteChannel {
        return `${channel}_complete`;
    }

    private buildProxyListener<T>(listener: (req: IpcRequest<T>, replier: IpcReplier) => void) {

        return (event: Electron.IpcMainEvent, req: IpcRequest<T>) => {
            const window = this.windows.getAppWindowFromWebContents(event.sender);
            const replier = (data: Observable<unknown>) => this.connectStream(req.responceChannel, window, data);
            listener(req, replier);
        }

    }

    public send<T>(channel: IpcChannel, window: AppWindow, response?: T|Error): void{
        this.windows.getWindow(window).webContents.send(channel, response);
    }

    public connectStream(channel: IpcChannel, window: AppWindow, observable: Observable<unknown>): void{
        observable.subscribe(data => {
            this.send(channel, window, data);
        }, error => {
            console.log("LAAAA 2", error);
            this.send(this.getErrorChannel(channel), window, error);
        }, () => {
            this.send(this.getCompleteChannel(channel), window);
        });
    }

    public on<T>(channel: IpcChannel, listener: (req: IpcRequest<T>, replier: IpcReplier) => void): void{
        ipcMain.on(channel, this.buildProxyListener(listener));
    }

    public once<T>(channel: IpcChannel, listener: (req: IpcRequest<T>, replier: IpcReplier) => void): void{
        ipcMain.once(channel, this.buildProxyListener(listener));
    }

}