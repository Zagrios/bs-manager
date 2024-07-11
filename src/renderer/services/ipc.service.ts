import { defaultIfEmpty, share } from "rxjs/operators";
import { Observable, ReplaySubject, identity } from "rxjs";
import { IpcRequest, IpcResponse } from "shared/models/ipc";
import { deserializeError } from 'serialize-error';
import { IpcCompleteChannel, IpcErrorChannel, IpcTearDownChannel } from "shared/models/ipc/ipc-response.interface";
import { IpcChannels, IpcRequestType, IpcResponseType } from "shared/models/ipc/ipc-routes";

export class IpcService {
    private static instance: IpcService;

    private readonly channelObservables: Map<string, Observable<unknown>>;

    public static getInstance(): IpcService {
        if (!IpcService.instance) {
            IpcService.instance = new IpcService();
        }
        return IpcService.instance;
    }

    private constructor() {
        this.channelObservables = new Map<string, Observable<IpcResponse<unknown>>>();
    }

    /**
     * @deprecated use sendV2 instead
     */
    public send<T, U = unknown>(channel: string, request?: IpcRequest<U>): Promise<IpcResponse<T>> {
        if (!request) {
            request = { args: null, responceChannel: null };
        }
        if (!request.responceChannel) {
            request.responceChannel = `${channel}_responce_${new Date().getTime()}`;
        }

        const promise = new Promise<IpcResponse<T>>(resolve => {
            window.electron.ipcRenderer.once(request.responceChannel, (response: IpcResponse<T>) => resolve(response));
        });

        window.electron.ipcRenderer.sendMessage(channel, request);

        return promise;
    }

    public sendLazy<T = unknown>(channel: string, request?: IpcRequest<T>): void {
        window.electron.ipcRenderer.sendMessage(channel, request);
    }

    // Also need a rework
    public watch<T>(channel: string): Observable<T> {
        if (this.channelObservables.has(channel)) {
            return this.channelObservables.get(channel) as Observable<T>;
        }

        const obs = new Observable<T>(observer => {
            window.electron.ipcRenderer.on(channel, (res) => {
                observer.next(res);
            });
        });

        this.channelObservables.set(channel, obs);

        return obs;
    }

    // TODO : Convert all IPCs calls to V2

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
