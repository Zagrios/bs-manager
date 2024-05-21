import { BsmException } from "../bsm-exception.model";

export interface IpcResponse<T> {
    data?: T;
    error?: BsmException;
    success: boolean;
}

export type IpcErrorChannel = `${string}_error`;
export type IpcCompleteChannel = `${string}_complete`;
export type IpcTearDownChannel = `${string}_teardown`;
