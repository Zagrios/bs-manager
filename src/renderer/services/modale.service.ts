import { Observable } from "rxjs";
import { BehaviorSubject } from "rxjs";
import { timeout } from "rxjs/operators";

export class ModalService{

    private static instance: ModalService;

    private _modalToShow$: BehaviorSubject<ModalComponent> = new BehaviorSubject(null);
    private modalData: any = null;
    private resolver: any;
    
    private constructor(){}

    public static getInsance(){
        if(!this.instance){ this.instance = new ModalService(); }
        return this.instance;
    }

    private close(){
        if(this.resolver){ this.resolve({exitCode: ModalExitCode.NO_CHOICE}); }
        this._modalToShow$.next(null);
    }

    public getModalData<Type>(): Type{
        return this.modalData;
    } 

    public getResolver(): any{
        return this.resolver;
    }

    public resolve(data: ModalResponse<unknown>): void{
        this.resolver(data);
    }

    public async openModal<T, K>(modal: ModalComponent<T, K>, data?: K): Promise<ModalResponse<T>>{
        this.close();
        await timeout(100); //Must wait resolve
        const promise = new Promise<ModalResponse<T>>((resolve) => { this.resolver = resolve; });
        this._modalToShow$.next(modal);
        promise.then(() => this.close());
        if(data){ this.modalData = data; }
        else{ this.modalData = null; }
        return promise;
    }

    public getModalToShow(): Observable<ModalComponent>{
        return this._modalToShow$.asObservable();
    }

}

export type ModalComponent<T = unknown, K = any> = ({resolver, data}: {resolver : (x: ModalResponse<T>) => void, data?: K}) => JSX.Element;

export const enum ModalExitCode {
    NO_CHOICE = -1,
    COMPLETED = 0,
    CLOSED = 1,
    CANCELED = 2,
}

export interface ModalResponse<T = unknown> {
    exitCode: ModalExitCode,
    data?: T
}
