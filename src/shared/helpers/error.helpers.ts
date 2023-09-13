export function tryit<Return>(func: () => Return): {error: Error, result: Return} {
    try {
        return { error: null, result: func() };
    } catch (err) {
        return { error: err instanceof Error ? err : new Error(`${err}`), result: null }
    }
}