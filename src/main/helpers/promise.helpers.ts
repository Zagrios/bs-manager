export async function allSettled<T>(promises: Promise<T>[]): Promise<T[]> {
    const settledPromises = await Promise.allSettled(promises);
    return settledPromises.map(p => p.status === 'fulfilled' ? p.value : null);
}