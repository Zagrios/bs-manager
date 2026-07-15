export function abortableDelay(timeoutMs: number, signal?: AbortSignal): Promise<boolean> {
    return new Promise(resolve => {
        if (signal?.aborted) {
            resolve(false);
            return;
        }

        let settled = false;
        let timer: NodeJS.Timeout;
        const finish = (completed: boolean) => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve(completed);
        };
        const onAbort = () => finish(false);
        timer = setTimeout(() => finish(true), timeoutMs);
        signal?.addEventListener("abort", onAbort, { once: true });
    });
}
