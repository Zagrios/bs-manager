export type FieldRequired<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>; // All fields of T are optional except for K
export type ObjectValues<T> = T[keyof T]; // All values of T
