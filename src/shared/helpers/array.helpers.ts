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

export function popElement<T = unknown>(func: (element: T) => boolean, arr: T[]): T {
    const index = arr.findIndex(func);
    if (index === -1) {
        return null;
    }
    return arr.splice(index, 1)[0];
}

export function removeIndex<T = unknown>(index: number, arr: T[]): T[] {
    arr.splice(index, 1);
    return arr;
}

export function* enumerate<T = unknown>(arr: T[]): Generator<[number, T]> {
    for (let i = 0; i < arr.length; i++) {
        yield [i, arr[i]];
    }
}
