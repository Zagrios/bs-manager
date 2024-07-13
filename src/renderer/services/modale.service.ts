import { Observable, BehaviorSubject } from "rxjs";

export class ModalService {
    private static instance: ModalService;

    private _modalToShow$: BehaviorSubject<ModalObject[]> = new BehaviorSubject([]);
    private modalData: unknown = null;

    private constructor() {}

    public static getInstance() {
        if (!this.instance) {
            this.instance = new ModalService();
        }
        return this.instance;
    }

    public getModalData<Type>(): Type {
        return this.modalData as Type;
    }

    public async openModal<T, K>(modal: ModalComponent<T, K>, options?: ModalOptions<K>): Promise<ModalResponse<T>> {
        let resolver: (value: ModalResponse | PromiseLike<ModalResponse>) => void;
        const promise = new Promise<ModalResponse<T>>(resolve => {
            resolver = resolve as (value: ModalResponse | PromiseLike<ModalResponse>) => void;
        });
        const modalObj = {modal: modal as ModalComponent, resolver, options};
        this._modalToShow$.next([...this._modalToShow$.getValue(), modalObj]);

        promise.then(() => {
            this._modalToShow$.next(this._modalToShow$.getValue().filter(m => m !== modalObj));
        });

        return promise;
    }

    public getModalToShow(): Observable<ModalObject[]> {
        return this._modalToShow$.asObservable();
    }
}

export type ModalOptions<T = unknown> = { readonly data?: T, readonly noStyle?: boolean }
export type ModalComponent<Return = unknown, Receive = unknown> = ({ resolver, options }: { readonly resolver: (x: ModalResponse<Return>) => void; readonly options?: ModalOptions<Receive> }) => JSX.Element;
export type ModalObject = {modal: ModalComponent, resolver: (value: ModalResponse | PromiseLike<ModalResponse>) => void, options: ModalOptions};

export const enum ModalExitCode {
    NO_CHOICE = -1,
    COMPLETED = 0,
    CLOSED = 1,
    CANCELED = 2,
}

export interface ModalResponse<T = unknown> {
    exitCode: ModalExitCode;
    data?: T;
}
