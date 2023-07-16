import { Observable, BehaviorSubject } from "rxjs";
import { timeout } from "rxjs/operators";

export class ModalService {
    private static instance: ModalService;

    private _modalToShow$: BehaviorSubject<ModalComponent> = new BehaviorSubject(null);
    private modalData: unknown = null;
    private resolver: (value: ModalResponse | PromiseLike<ModalResponse>) => void = null;

    private constructor() {}

    public static getInstance() {
        if (!this.instance) {
            this.instance = new ModalService();
        }
        return this.instance;
    }

    private close() {
        if (this.resolver) {
            this.resolve({ exitCode: ModalExitCode.NO_CHOICE });
        }
        this._modalToShow$.next(null);
    }

    public getModalData<Type>(): Type {
        return this.modalData as Type;
    }

    public getResolver(): any {
        return this.resolver;
    }

    public resolve(data: ModalResponse<unknown>): void {
        this.resolver(data);
    }

    public async openModal<T, K>(modal: ModalComponent<T, K>, data?: K): Promise<ModalResponse<T>> {
        this.close();
        await timeout(100); // Must wait resolve
        const promise = new Promise<ModalResponse<T>>(resolve => {
            this.resolver = resolve as (value: ModalResponse | PromiseLike<ModalResponse>) => void;
        });
        this._modalToShow$.next(modal as ModalComponent);
        promise.then(() => this.close());
        if (data) {
            this.modalData = data;
        } else {
            this.modalData = null;
        }
        return promise;
    }

    public getModalToShow(): Observable<ModalComponent> {
        return this._modalToShow$.asObservable();
    }
}

export type ModalComponent<Return = unknown, Receive = unknown> = ({ resolver, data }: { resolver: (x: ModalResponse<Return>) => void; data?: Receive }) => JSX.Element;

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
