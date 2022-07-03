import { BsmException } from "./bsm-exception.model";

export interface IpcRequest<T>{
    args?: T,
    responceChannel?: string
}

export interface IpcResponse<T>{
    data?: T,
    error?: BsmException,
    success: boolean,
}