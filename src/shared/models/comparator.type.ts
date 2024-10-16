
export enum Comparison {
    EQUAL = 0,
    GREATER = 1,
    LESSER = -1,
};

export type Comparator<T> = (object1: T, object2: T) => number;
