import { BehaviorSubject } from "rxjs";
import { map, distinctUntilChanged, filter } from "rxjs/operators";
import { from } from "rxjs";
import { Observable } from "rxjs";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import { NotificationService } from "./notification.service";
import { LinkOptions } from "main/services/folder-linker.service";

export class FolderLinkerService {

    private static instance: FolderLinkerService;

    public static getInstance(): FolderLinkerService {
        if (!FolderLinkerService.instance) {
            FolderLinkerService.instance = new FolderLinkerService();
        }
        return FolderLinkerService.instance;
    }

    private readonly ipc: IpcService;
    private readonly progress: ProgressBarService;
    private readonly notification: NotificationService;

    private readonly onLinkedListeners = new Map<string, () => void>();
    private readonly onUnlinkedListeners = new Map<string, () => void>();
    private readonly onRemovedFromQueueListeners = new Map<string, () => void>();

    private readonly publicOnLinkedListeners = new Set<(folder: string) => void>();
    private readonly publicOnUnlinkedListeners = new Set<(folder: string) => void>();

    private readonly _currentAction$ = new BehaviorSubject<LinkAction>(null);
    private readonly _queue$ = new BehaviorSubject<LinkAction[]>([]);

    private constructor() {
        this.ipc = IpcService.getInstance();
        this.progress = ProgressBarService.getInstance();
        this.notification = NotificationService.getInstance();

        this.queue$.pipe(map(queue => !!queue.length), distinctUntilChanged(), filter(haveAction => haveAction)).subscribe(() => {
            this.startQueue();
        });
    }

    private async startQueue(): Promise<void>{

        while(this._queue$.value.at(0)){

            const toDo = this._queue$.value.at(0);

            let progressOpened = false;

            if(!this.progress.isVisible){
                this.progress.showFake(.01, null, toDo.folder.split("\\").at(-1));
                progressOpened = true;
            }
            
            this._currentAction$.next(toDo);
            await this.doAction(toDo).toPromise();

            this.specialFolderNotification(toDo);

            if(toDo.type === LinkActionType.Link){
                this.onLinkedListeners.get(toDo.folder)?.();
                this.publicOnLinkedListeners.forEach(listener => listener(toDo.folder));
                this.onLinkedListeners.delete(toDo.folder);
            }
            else{
                this.onUnlinkedListeners.get(toDo.folder)?.();
                this.publicOnUnlinkedListeners.forEach(listener => listener(toDo.folder));
                this.onUnlinkedListeners.delete(toDo.folder);
            }

            const newArr = [...this._queue$.value];
            newArr.shift();
            this._queue$.next(newArr);

            if(progressOpened){
                this.progress.hide(true);
            }

        }

        this._currentAction$.next(null);
    }

    private specialFolderNotification(action: LinkAction): void{
        if(action.type === LinkActionType.Link && action.folder.includes("UserData")){
            this.notification.notifyInfo({
                title: "notifications.shared-folder.info.userdata-backup-created.title",
                desc: "notifications.shared-folder.info.userdata-backup-created.msg",
                duration: 7000
            });
            return;
        }
    }

    private doAction(action: LinkAction): Observable<void>{
        return this.ipc.sendV2<void, {folder: string, options?: LinkOptions}>(action.type === LinkActionType.Link ? "link-folder" : "unlink-folder", { args: { folder: action.folder, options: action.options } });
    }
    
    private addFolderToQueue(folder: string, type: LinkActionType, options: LinkOptions){
        if(this._queue$.value.some(action => action.folder === folder)){ return; }
        this._queue$.next([...this._queue$.value, {folder, type, options}]);
    }

    private removeFolderFromQueue(folder: string){
        const queue = this._queue$.value;
        const index = queue.findIndex(action => action.folder === folder);
        if(index === -1){ return; }
        this.onRemovedFromQueueListeners.get(folder)?.();
        queue.splice(index, 1);
        this._queue$.next(queue);
    }

    private onLinked(folder: string, callback: () => void){ this.onLinkedListeners.set(folder, callback); }
    private onUnlinked(folder: string, callback: () => void){ this.onUnlinkedListeners.set(folder, callback); }
    private onRemovedFromQueue(folder: string, callback: () => void){ this.onRemovedFromQueueListeners.set(folder, callback); }
    
    public isFolderLinked(path: string): Observable<boolean> { 
        return this.ipc.sendV2<boolean>("is-folder-symlink", {args: path});
    }

    public linkFolders(...folders: string[]): Map<string, Observable<void>> {
        return new Map(folders.map(folder => [folder, this.linkFolder(folder)]));
    }

    public linkFolder(folder: string, options: LinkOptions = {}): Observable<void> {
        options.keepContents ??= true;
        const promise = new Promise<void>(resolve => {
            this.onLinked(folder, resolve);
            this.onRemovedFromQueue(folder, resolve);
        });

        this.addFolderToQueue(folder, LinkActionType.Link, options);
        return from(promise);
    }

    public unlinkFolders(...folders: string[]): Map<string, Observable<void>> {
        return new Map(folders.map(folder => [folder, this.unlinkFolder(folder)]));
    }

    public unlinkFolder(folder: string, options: LinkOptions = {}): Observable<void> {
        options.keepContents ??= true;
        const promise = new Promise<void>(resolve => {
            this.onUnlinked(folder, resolve);
            this.onRemovedFromQueue(folder, resolve);
        });

        this.addFolderToQueue(folder, LinkActionType.Unlink, options);
        return from(promise);
    }

    public cancelFolder(folder: string): void {
        this.removeFolderFromQueue(folder);
    }

    public get queue$(): Observable<LinkAction[]> { return this._queue$.asObservable(); }
    public get currentAction$(): Observable<LinkAction> { return this._currentAction$.asObservable(); }

    public isPending(folder: string): Observable<boolean> {
        return this.queue$.pipe(map(queue => queue.some(action => action.folder === folder), distinctUntilChanged()));
    }

    public isProcessing(folder: string): Observable<boolean> {
        return this.currentAction$.pipe(distinctUntilChanged(), map(action => action?.folder === folder));
    }

    public onFolderLinked(callback: (folder: string) => void): void { this.publicOnLinkedListeners.add(callback); }
    public removeOnFolderLinked(callback: (folder: string) => void): void { this.publicOnLinkedListeners.delete(callback); }
    public onFolderUnlinked(callback: (folder: string) => void): void { this.publicOnUnlinkedListeners.add(callback); }
    public removeOnFolderUnlinked(callback: (folder: string) => void): void { this.publicOnUnlinkedListeners.delete(callback); }

}

export interface LinkAction {
    folder: string;
    type: LinkActionType;
    options?: LinkOptions;
}

export enum LinkActionType {
    Link,
    Unlink
}