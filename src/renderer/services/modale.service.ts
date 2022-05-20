import { BehaviorSubject } from "rxjs";

export class ModalService{

    private static instance: ModalService;

    private _modalType$: BehaviorSubject<ModalType> = new BehaviorSubject<ModalType>(null);
    private resolver: any;
    private constructor(){}

    public static getInsance(){
        if(!this.instance){ this.instance = new ModalService(); }
        return this.instance;
    }

    private close(){
        this.modalType$.next(null);
    }

    public get modalType$(): BehaviorSubject<any>{
        return this._modalType$;
    }

    public getResolver(): any{
        return this.resolver;
    }

    public resolve(data: ModalResponse): void{
        this.resolver(data);
    }

    public openModal(modalType: ModalType): Promise<ModalResponse>{
        if(this.resolver){ this.resolver(ModalExitCode.NO_CHOICE); }
        let resolver, rejecter;
        const promise = new Promise<ModalResponse>((resolve, reject) => { resolver = resolve; rejecter = reject; });
        this.modalType$.next(modalType);
        promise.then(() => this.close());
        this.resolver = resolver;
        return promise;
    }
}

export enum ModalType {
    STEAM_LOGIN = "STEAM_LOGIN",
    GUARD_CODE = "GUARD_CODE",
}

export enum ModalExitCode {
    NO_CHOICE = -1,
    COMPLETED = 0,
    CLOSED = 1,
    CANCELED = 2,
}

export interface ModalResponse {
    exitCode: ModalExitCode,
    data?: any
}