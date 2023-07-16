export function objectFromEntries<T>(entries: Iterable<readonly [PropertyKey, T]>): Record<PropertyKey, T | T[]> {
    const temp: Record<PropertyKey, T | T[]> = {};

    for (const [key, value] of entries) {
        if (temp[key]) {
            temp[key] = Array.isArray(temp[key]) ? [...(temp[key] as T[]), value] : [(temp[key] as T), value];
        } else {
            temp[key] = value;
        }
    }

    return temp;
}