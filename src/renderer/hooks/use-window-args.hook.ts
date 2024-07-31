import { useConstant } from "./use-constant.hook";

export function useWindowArgs<Key extends string>(...keys: Key[]): Record<Key, string|undefined> {

    const getArgs = (...keys: Key[]) => {
        const url = new URLSearchParams(window.location.search);
        const result = {} as Record<Key, string>;
        keys.forEach(key => {
            result[key] = url.get(key) || undefined;
        });

        return result;
    }

    return useConstant(() => getArgs(...keys));
}
