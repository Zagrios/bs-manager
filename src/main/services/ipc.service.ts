import { IpcRequest } from "shared/models/ipc";
import { BrowserWindow, ipcMain } from "electron";
import { Observable } from "rxjs";
import { IpcCompleteChannel, IpcErrorChannel, IpcTearDownChannel } from "shared/models/ipc/ipc-response.interface";
import { IpcReplier } from "shared/models/ipc/ipc-request.interface";
import { serializeError } from 'serialize-error';
import log from "electron-log";

export class IpcService {
    private static instance: IpcService;

    public static getInstance(): IpcService {
        if (!IpcService.instance) {
            IpcService.instance = new IpcService();
        }
        return IpcService.instance;
    }

    private constructor() {}

    private getErrorChannel(channel: string): IpcErrorChannel {
        return `${channel}_error`;
    }

    private getCompleteChannel(channel: string): IpcCompleteChannel {
        return `${channel}_complete`;
    }

    private getTearDownChannel(channel: string): IpcTearDownChannel {
        return `${channel}_teardown`;
    }

    private buildProxyListener<T>(listener: IpcListener<T>) {
        return (event: Electron.IpcMainEvent, req: IpcRequest<T>) => {
            const window = BrowserWindow.fromWebContents(event.sender);
            const replier = (data: Observable<unknown>) => this.connectStream(req.responceChannel, window, data);
            listener(req, replier);
        };
    }

    public send<T>(channel: string, window: BrowserWindow, response?: T | Error): void {
        if(window.webContents?.isDestroyed()){ return; }
        window.webContents?.send(channel, response);
    }

    private connectStream(channel: string, window: BrowserWindow, observable: Observable<unknown>): void {

        const sub = observable.subscribe({
            next: data => this.send(channel, window, data),
            error: error => {
                log.error(error, error?.code);
                this.send(this.getErrorChannel(channel), window, serializeError(error));
            },
            complete: () => this.send(this.getCompleteChannel(channel), window)
        })

        window.webContents.once("destroyed", () => sub.unsubscribe());
        window.webContents.ipc.once(this.getTearDownChannel(channel), () => sub.unsubscribe());

        sub.add(() => {
            window.webContents.ipc.removeAllListeners(this.getTearDownChannel(channel));
        });
    }

    public on<T>(channel: string, listener: IpcListener<T>, ipc = ipcMain): void {
        ipc.on(channel, this.buildProxyListener(listener));
    }

    public once<T>(channel: string, listener: IpcListener<T>, ipc = ipcMain): void {
        ipc.once(channel, this.buildProxyListener(listener));
    }
}

type IpcListener<T = unknown> = (req: IpcRequest<T>, replier: IpcReplier) => void | Promise<void>;
