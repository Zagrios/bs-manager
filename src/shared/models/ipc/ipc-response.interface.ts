import { BsmException } from "../bsm-exception.model";

export interface IpcResponse<T>{
   data?: T,
   error?: BsmException,
   success: boolean,
}

export type IpcChannel = string;
export type IpcErrorChannel = IpcChannel & `${string}_error`;
export type IpcCompleteChannel = IpcChannel & `${string}_complete`;