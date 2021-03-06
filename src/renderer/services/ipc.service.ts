import { Observable } from "rxjs";
import { IpcRequest, IpcResponse } from "shared/models/ipc";

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

    public send<T>(channel: string, request?: IpcRequest<any>): Promise<IpcResponse<T>>{
        if(!request){ request = {args: null, responceChannel: null}; }
        if(!request.responceChannel){ request.responceChannel = `${channel}_responce_${new Date().getTime()}`; }

        const promise = new Promise<IpcResponse<T>>(resolve => {
            window.electron.ipcRenderer.once(request.responceChannel, (response: IpcResponse<T>) => resolve(response));
        });

        window.electron.ipcRenderer.sendMessage(channel, request);

        return promise;
    }

    public sendLazy(channel: string, request?: IpcRequest<any>): void{
        window.electron.ipcRenderer.sendMessage(channel, request);
    }

    public watch<T>(channel: string): Observable<IpcResponse<T>>{
        if(this.channelObservables.has(channel)){ return this.channelObservables.get(channel) as Observable<IpcResponse<T>>; }

        const obs = new Observable<IpcResponse<T>>(observer => {
            window.electron.ipcRenderer.on(channel, res => {
                observer.next(res);
            });
        })

        this.channelObservables.set(channel, obs);

        return obs;
    }

}