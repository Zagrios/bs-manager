import { IpcRequest } from "shared/models/ipc";
import { BrowserWindow, IpcMainEvent, WebContents, ipcMain } from "electron";
import { Observable } from "rxjs";
import { IpcCompleteChannel, IpcErrorChannel, IpcTearDownChannel } from "shared/models/ipc/ipc-response.interface";
import { IpcReplier } from "shared/models/ipc/ipc-request.interface";
import { serializeError } from 'serialize-error';
import log from "electron-log";
import { IpcChannels, IpcRequestType, IpcResponseType } from "shared/models/ipc/ipc-routes";

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

    private buildProxyListener<C extends IpcChannels>(listener: IpcListenerFromChannel<C>) {
        return (event: IpcMainEvent, req: IpcRequest<IpcRequestType<C>>) => {
            const window = BrowserWindow.fromWebContents(event.sender);
            const replier = (data: Observable<unknown>) => this.connectStream(req.responceChannel, window, data);
            listener(req.args, replier, event.sender);
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

        const unsubscribe = () => sub.unsubscribe();

        window.webContents.once("destroyed", unsubscribe);
        window.webContents.ipc.once(this.getTearDownChannel(channel), unsubscribe);

        sub.add(() => {
            window.webContents.ipc.removeAllListeners(this.getTearDownChannel(channel));
            window.webContents.removeListener("destroyed", unsubscribe);
        });
    }

    public on<C extends IpcChannels>(channel: C, listener: IpcListenerFromChannel<C>, ipc = ipcMain): void {
        ipc.on(channel as string, this.buildProxyListener(listener));
    }

    public once<C extends IpcChannels>(channel: C, listener: IpcListenerFromChannel<C>, ipc = ipcMain): void {
        ipc.once(channel as string, this.buildProxyListener(listener));
    }
}


type IpcListener<TRequest = unknown, TResponse = unknown> = (req: TRequest, replier: IpcReplier<TResponse>, webContents: WebContents) => void | Promise<void>;
type IpcListenerFromChannel<C extends IpcChannels> = IpcListener<IpcRequestType<C>, IpcResponseType<C>>;
