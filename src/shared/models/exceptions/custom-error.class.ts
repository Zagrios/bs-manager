export class CustomError extends Error {

    public readonly code: string;
    public readonly data?: unknown;

    constructor(message: string, code: string, data?: unknown){
        super(message);
        this.code = code;
        this.data = data;
    }

    public static fromError(error: Error, code?: string, data?: unknown): CustomError{

        if(error instanceof CustomError){
            return error;
        }

        code ||= (error as unknown as {code: string}).code || CustomErrorCodes.UNKNOWN_ERROR;

        const customError = new CustomError(error.message ?? error.toString(), code, data);
        customError.stack = error.stack;
        return customError;
    }

    public static throw(error: Error, code?: string, data?: unknown): never{
        throw CustomError.fromError(error, code, data);
    }

}

export enum CustomErrorCodes {
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
}
