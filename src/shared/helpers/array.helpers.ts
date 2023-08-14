export function splitIntoChunk<T = unknown>(arr: T[], chunkSize: number): T[][] {
    const resArr = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        resArr.push(arr.slice(i, i + chunkSize));
    }
    return resArr;
}

export function swapElements<T = unknown>(from: number, to: number, arr: T[]): T[] {
    [arr[from], arr[to]] = [arr[to], arr[from]];
    return arr;
}
