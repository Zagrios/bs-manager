import { isFunction } from "./function.helpers";

export type AllSettledHelperOptions = {
    keepStructure?: boolean;
    removeFalsy?: boolean;
};

export async function allSettled<T>(promises: Promise<T>[], options?: AllSettledHelperOptions): Promise<T[]> {
    const settledPromises = await Promise.allSettled(promises);
    if (options?.keepStructure) {
        return settledPromises.map(p => (p.status === "fulfilled" ? p.value : null));
    }

    return settledPromises.reduce((acc, p) => {
        if (p.status === "fulfilled") {
            if (options?.removeFalsy && !p.value) {
                return acc;
            }
            acc.push(p.value);
        }
        return acc;
    }, []);
}

export function isPromise(value: any): value is Promise<unknown> {
    if(!value) { return false; }
    if(!value.then) { return false; }
    if(!isFunction(value.then)) { return false; }
    return true;
}
