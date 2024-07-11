import { Observable } from "rxjs";

export interface IpcRequest<T> {
    args?: T;
    responceChannel?: string;
}

export type IpcReplier<T> = (data: Observable<T>) => void;
