import { coerce, lt, gt, valid } from "semver";
import { tryit } from "./error.helpers";

export function safeLt(a: string, b: string): boolean {
    const { result } = tryit(() => lt(valid(coerce(a)), valid(coerce(b))));
    return result ?? false;
}

export function safeGt(a: string, b: string): boolean {
    const { result } = tryit(() => gt(valid(coerce(a)), valid(coerce(b))));
    return result ?? false;
}

