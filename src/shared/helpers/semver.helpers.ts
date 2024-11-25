import { coerce, lt, valid } from "semver";
import { tryit } from "./error.helpers";

export function safeLt(a: string, b: string): boolean {
    const { result } = tryit(() => lt(valid(coerce(a)), valid(coerce(b))));
    return result ?? false;
}

