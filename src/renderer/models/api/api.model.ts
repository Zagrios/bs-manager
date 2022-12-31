export interface ApiResult<T = unknown>{
    status: number,
    data: T
}