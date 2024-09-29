import { defaultIfEmpty, share } from "rxjs/operators";
import { Observable, ReplaySubject, identity } from "rxjs";
import { IpcRequest } from "shared/models/ipc";
import { deserializeError } from 'serialize-error';
import { IpcCompleteChannel, IpcErrorChannel, IpcTearDownChannel } from "shared/models/ipc/ipc-response.interface";
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

    public sendLazy<T = unknown>(channel: string, request?: IpcRequest<T>): void {
        window.electron.ipcRenderer.sendMessage(channel, request);
    }

    public sendV2<C extends IpcChannels>(channel: C, data?: IpcRequestType<C>, defaultValue?: IpcResponseType<C>): Observable<IpcResponseType<C>> {

        const request: IpcRequest<IpcRequestType<C>> = {
            args: data,
            responceChannel: `${channel}_responce_${crypto.randomUUID()}`
        };

        const completeChannel: IpcCompleteChannel = `${request.responceChannel}_complete`;
        const errorChannel: IpcErrorChannel = `${request.responceChannel}_error`;
        const teardownChannel: IpcTearDownChannel = `${request.responceChannel}_teardown`;

        const obs = new Observable<IpcResponseType<C>>(observer => {
            window.electron.ipcRenderer.on(request.responceChannel, (res: IpcResponseType<C>) => observer.next(res));
            window.electron.ipcRenderer.on(errorChannel, (err) => observer.error(deserializeError(err)));
            window.electron.ipcRenderer.on(completeChannel, () => observer.complete());

            window.electron.ipcRenderer.sendMessage(channel as string, request);

            return () => {
                window.electron.ipcRenderer.removeAllListeners(request.responceChannel);
                window.electron.ipcRenderer.removeAllListeners(errorChannel);
                window.electron.ipcRenderer.removeAllListeners(completeChannel);
                window.electron.ipcRenderer.sendMessage(teardownChannel, null);
            };
        }).pipe(defaultValue ? defaultIfEmpty(defaultValue) : identity, share({connector: () => new ReplaySubject(1)}));

        return obs;
    }
}
