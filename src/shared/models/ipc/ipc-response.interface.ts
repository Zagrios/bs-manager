import { BsmException } from "../bsm-exception.model";

export interface IpcResponse<T> {
    data?: T;
    error?: BsmException;
    success: boolean;
}

export type IpcErrorChannel = string & `${string}_error`;
export type IpcCompleteChannel = string & `${string}_complete`;
