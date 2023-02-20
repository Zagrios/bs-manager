import { Observable } from "rxjs";
import { IpcResponse } from "./ipc-response.interface";

export interface IpcRequest<T>{
   args?: T,
   responceChannel?: string,
}

export type IpcReplier= <T>(data: Observable<T>) => void;