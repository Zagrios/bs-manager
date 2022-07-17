import { BsmException } from "../bsm-exception.model";

export interface IpcResponse<T>{
   data?: T,
   error?: BsmException,
   success: boolean,
}