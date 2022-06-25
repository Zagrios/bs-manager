export interface IpcRequest<T>{
    args?: T,
    responceChannel?: string
}

export interface IpcResponse<T>{
    data?: T,
    error?: any,
    success: boolean,
}