import log from "electron-log";
import { isPromise } from "../../shared/helpers/promise.helpers";
import { tryit } from "../../shared/helpers/error.helpers";

type LogOptions = {
    logInput?: boolean;
    logOutput?: boolean;
    logArgs?: boolean;
};

const stringifyArgs = (args: unknown[]) => {
    return args?.map(a => JSON.stringify(a)).join(', ');
};

const logInfo = (message: string, propertyKey: string, args: unknown[], logArgs: boolean, result: unknown) => {
    log.info(`[${message}] ${propertyKey}(${logArgs ? stringifyArgs(args) : ''})`, result);
};

const logError = (propertyKey: string, args: unknown[], logArgs: boolean, error: unknown) => {
    log.error(`[ERROR] ${propertyKey}(${logArgs ? stringifyArgs(args) : ''})`, error);
    throw error;
};

export function Log(options?: LogOptions){

    const logInput = options?.logInput ?? false;
    const logOutput = options?.logOutput ?? true;
    const logArgs = options?.logArgs ?? true;

    return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;

        descriptor.value = function(...args: unknown[]) {

            if (logInput) {
                logInfo('INPUT', propertyKey, args, logArgs, null);
            }

            const outcome = tryit(() => originalMethod.apply(this, args));

            if (isPromise(outcome)) {
                return outcome.then(({ result, error }) => {

                    if (error) {
                        logError(propertyKey, args, logArgs, error);
                    }
                    if (logOutput) {
                        logInfo('OUTPUT', propertyKey, args, logArgs, result);
                    }
                    return result;
                });
            }

            const { result, error } = outcome;

            if (error) {
                logError(propertyKey, args, logArgs, error);
            }

            if (logOutput) {
                logInfo('OUTPUT', propertyKey, args, logArgs, result);
            }

            return result;
        };
    };
}
