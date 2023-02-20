import { defaultIfEmpty } from "rxjs/operators";
import { Observable } from "rxjs";
import { IpcRequest, IpcResponse } from "shared/models/ipc";
import { identity } from "rxjs";

export class IpcService {

    private static instance: IpcService;

    private readonly channelObservables: Map<string, Observable<IpcResponse<unknown>>>;

    public static getInstance(): IpcService{
        if(!IpcService.instance){ IpcService.instance = new IpcService(); }
        return IpcService.instance;
    }

    private constructor(){
        this.channelObservables = new Map<string, Observable<IpcResponse<unknown>>>();
    }

    public send<T, U = unknown>(channel: string, request?: IpcRequest<U>): Promise<IpcResponse<T>>{
        if(!request){ request = {args: null, responceChannel: null}; }
        if(!request.responceChannel){ request.responceChannel = `${channel}_responce_${new Date().getTime()}`; }

        const promise = new Promise<IpcResponse<T>>(resolve => {
            window.electron.ipcRenderer.once(request.responceChannel, (response: IpcResponse<T>) => resolve(response));
        });

        window.electron.ipcRenderer.sendMessage(channel, request);

        return promise;
    }

    public sendLazy<T = any>(channel: string, request?: IpcRequest<T>): void{
        window.electron.ipcRenderer.sendMessage(channel, request);
    }

    public watch<T>(channel: string): Observable<IpcResponse<T>>{
        if(this.channelObservables.has(channel)){ return this.channelObservables.get(channel) as Observable<IpcResponse<T>>; }

        const obs = new Observable<IpcResponse<T>>(observer => {
            window.electron.ipcRenderer.on(channel, (res: IpcResponse<T>) => {
                observer.next(res);
            });
        })

        this.channelObservables.set(channel, obs);

        return obs;
    }

    // TODO : Convert all IPCs calls to V2

    public sendV2<T, U = unknown>(channel: string, request?: IpcRequest<U>, defaultValue?: T): Observable<T>{
        if(!request){ request = {args: null, responceChannel: null}; }
        if(!request.responceChannel){ request.responceChannel = `${channel}_responce_${new Date().getTime()}`; }

        const completeChannel = `${request.responceChannel}_complete`;
        const errorChannel = `${request.responceChannel}_error`;

        const obs = new Observable<T>(observer => {
            window.electron.ipcRenderer.on(request.responceChannel, (res: T) => observer.next(res));
            window.electron.ipcRenderer.on(errorChannel, (err: Error) => observer.error(err));
            window.electron.ipcRenderer.on(completeChannel, () => observer.complete());
        }).pipe(defaultValue ? defaultIfEmpty(defaultValue) : identity);

        window.electron.ipcRenderer.once(completeChannel, () => {
            window.electron.ipcRenderer.removeAllListeners(request.responceChannel);
            window.electron.ipcRenderer.removeAllListeners(errorChannel);
            window.electron.ipcRenderer.removeAllListeners(completeChannel);
        });

        window.electron.ipcRenderer.sendMessage(channel, request);

        return obs;
    }

}