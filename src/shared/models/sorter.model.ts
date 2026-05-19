import { Comparator } from "./comparator.type";

export type SorterOptions<T> = {
    defaultKey: string;
    comparators: Record<string, Comparator<T>>;
    tiebreak: Comparator<T>;
}

export class Sorter<T> {
    public readonly defaultKey: string;

    private readonly comparators: Record<string, Comparator<T>>;
    private readonly tiebreak: Comparator<T>;

    constructor(options: SorterOptions<T>) {
        this.defaultKey = options.defaultKey;
        this.comparators = options.comparators;
        this.tiebreak = options.tiebreak;
    }

    public getComparatorKeys(): string[] {
        return Object.keys(this.comparators);
    }

    public getDefaultComparator(): Comparator<T> {
        return this.comparators[this.defaultKey];
    }

    public getComparator(key: string): Comparator<T> {
        const comparator = this.comparators[key] || this.comparators[this.defaultKey];
        return this.tiebreak === comparator
            ? comparator
            : (object1, object2) => comparator(object1, object2) || this.tiebreak(object1, object2);
    }

}
