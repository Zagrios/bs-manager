import { Observable } from "rxjs";
import { IpcRequest } from "shared/models/ipc";
import { IpcChannels, IpcRequestType, IpcResponseType } from "shared/models/ipc/ipc-routes";

export interface IpcClientService {
    sendLazy<T = unknown>(
        channel: string,
        request: IpcRequest<T>
    ): void;

    sendV2<C extends IpcChannels>(
        channel: C,
        data?: IpcRequestType<C>,
        defaultValue?: IpcResponseType<C>
    ): Observable<IpcResponseType<C>>;
}

export interface ConfigurationClientService {
    get<T>(key: string): T;
    set(key: string, value: any, persistent?: boolean): void;
    delete(key: string): void;
    getAndDelete<T>(key: string): T;
}


export interface FetchResponse<T> {
    status: number;
    body: T;
}

export interface FetchOptions {
    headers?: Record<string, string>;
    query?: Record<string, string | number | string[]>;
    body?: any;
}

export interface FetchService {
    get<T>(url: string, options?: FetchOptions):
        Promise<FetchResponse<T>>;
    post<T>(url: string, options?: FetchOptions):
        Promise<FetchResponse<T>>;
}

