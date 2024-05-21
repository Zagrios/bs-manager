export interface Service<T> {
    getInstance: () => T;
}
