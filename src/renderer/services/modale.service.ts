import { BehaviorSubject, timeout } from "rxjs";

export class ModalService{

    private static instance: ModalService;

    private _modalType$: BehaviorSubject<ModalType> = new BehaviorSubject<ModalType>(null);
    private modalData: any = null;
    private resolver: any;
    
    private constructor(){}

    public static getInsance(){
        if(!this.instance){ this.instance = new ModalService(); }
        return this.instance;
    }

    private close(){
        if(this.resolver){ this.resolve({exitCode: ModalExitCode.NO_CHOICE}); }
        this.modalType$.next(null);
    }

    public get modalType$(): BehaviorSubject<any>{
        return this._modalType$;
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

    public async openModal<T>(modalType: ModalType, data?: any): Promise<ModalResponse<T>>{
        this.close();
        await timeout(100); //Must wait resolve
        const promise = new Promise<ModalResponse<T>>((resolve) => { this.resolver = resolve; });
        promise.then(() => this.close());
        this.modalType$.next(modalType);
        if(data){ this.modalData = data; }
        else{ this.modalData = null; }
        return promise;
    }

}

export enum ModalType {
    STEAM_LOGIN = "STEAM_LOGIN",
    GUARD_CODE = "GUARD_CODE",
    UNINSTALL = "UNINSTALL",
    INSTALLATION_FOLDER = "INSTALLATION_FOLDER",
    EDIT_VERSION = "EDIT_VERSION",
    CLONE_VERSION = "CLONE_VERSION"
}

export enum ModalExitCode {
    NO_CHOICE = -1,
    COMPLETED = 0,
    CLOSED = 1,
    CANCELED = 2,
}

export interface ModalResponse<T> {
    exitCode: ModalExitCode,
    data?: T
}
