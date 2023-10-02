export class CustomError extends Error {

    private readonly _code: string;
    private readonly _data?: unknown;

    constructor(message: string, code: string, data?: unknown){
        super(message);
        this._code = code;
        this._data = data;
    }

    public get code(): string { return this._code; }
    public get data(): unknown { return this._data; }

    public static fromError(error: Error, code: string, data?: unknown): CustomError{
        const customError = new CustomError(error.message ?? error.toString(), code, data);
        customError.stack = error.stack;
        return customError;
    }

    public static throw(error: Error, code: string, data?: unknown): never{
        throw CustomError.fromError(error, code, data);
    }

}