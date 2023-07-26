import { LinkOptions, UnlinkOptions } from "main/services/folder-linker.service";
import { map, distinctUntilChanged, filter, mergeMap, shareReplay } from "rxjs/operators";
import { BehaviorSubject, Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { IpcService } from "./ipc.service";
import { ProgressBarService } from "./progress-bar.service";
import equal from "fast-deep-equal";

export class VersionFolderLinkerService {
    private static instance: VersionFolderLinkerService;

    public static getInstance(): VersionFolderLinkerService {
        if (!VersionFolderLinkerService.instance) {
            VersionFolderLinkerService.instance = new VersionFolderLinkerService();
        }
        return VersionFolderLinkerService.instance;
    }

    private readonly ipcService: IpcService;
    private readonly progress: ProgressBarService;

    private readonly _queue$ = new BehaviorSubject<VersionLinkerAction[]>([]);

    private readonly linkListeners = new Set<VersionLinkerActionListener>();
    private readonly unlinkListeners = new Set<VersionLinkerActionListener>();

    private constructor() {
        this.ipcService = IpcService.getInstance();
        this.progress = ProgressBarService.getInstance();

        this.currentAction$.pipe(filter(action => !!action)).subscribe(action => this.processAction(action));
    }

    private async processAction(action: VersionLinkerAction) {
        let progressOpened = false;

        if (!this.progress.isVisible) {
            this.progress.showFake(0.01, null, action.relativeFolder.split(window.electron.path.sep).at(-1));
            progressOpened = true;
        }

        const linked = await this.doAction(action).toPromise();

        // Spécial notification

        if (action.type === VersionLinkerActionType.Link) {
            this.linkListeners.forEach(listener => listener(action, linked));
        } else {
            this.unlinkListeners.forEach(listener => listener(action, linked));
        }

        if (progressOpened) {
            this.progress.hide(true);
        }

        const newArr = [...this._queue$.value];
        newArr.shift();
        this._queue$.next(newArr);
    }

    private doAction(action: VersionLinkerAction): Observable<boolean> {
        return this.ipcService.sendV2<boolean, VersionLinkerAction>("link-version-folder-action", { args: action });
    }

    public linkVersionFolder(action: VersionLinkFolderAction): Promise<boolean> {
        const promise = new Promise<boolean>(resolve => {
            const callBack: VersionLinkerActionListener = (performedAction, linked) => {
                if (performedAction !== action) {
                    return;
                }
                this.removeVersionFolderLinkedListener(callBack);
                resolve(linked);
            };

            this.onVersionFolderLinked(callBack);
        });

        this._queue$.next([...this._queue$.value, action]);

        return promise;
    }

    public unlinkVersionFolder(action: VersionUnlinkFolderAction): Promise<boolean> {
        const promise = new Promise<boolean>(resolve => {
            const callBack: VersionLinkerActionListener = (performedAction, linked) => {
                if (performedAction !== action) {
                    return;
                }
                this.removeVersionFolderUnlinkedListener(callBack);
                resolve(linked);
            };

            this.onVersionFolderUnlinked(callBack);
        });

        this._queue$.next([...this._queue$.value, action]);

        return promise;
    }

    public onVersionFolderLinked(listener: VersionLinkerActionListener): void {
        this.linkListeners.add(listener);
    }

    public removeVersionFolderLinkedListener(listener: VersionLinkerActionListener): void {
        this.linkListeners.delete(listener);
    }

    public onVersionFolderUnlinked(listener: VersionLinkerActionListener): void {
        this.unlinkListeners.add(listener);
    }

    public removeVersionFolderUnlinkedListener(listener: VersionLinkerActionListener): void {
        this.unlinkListeners.delete(listener);
    }

    public cancelAction(version: BSVersion, relativeFolder: string): void {
        this._queue$.next(this._queue$.value.filter(a => a.version !== version || a.relativeFolder !== relativeFolder));
    }

    public isVersionFolderLinked(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.ipcService.sendV2("is-version-folder-linked", { args: { version, relativeFolder } });
    }

    public isPending(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.queue$.pipe(map(queue => queue.length > 0 && queue.some(action => action.version === version && action.relativeFolder === relativeFolder), distinctUntilChanged()));
    }

    public isProcessing(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.currentAction$.pipe(map(action => action && action.version === version && action.relativeFolder === relativeFolder));
    }

    public getLinkedFolders(version: BSVersion, options?: { relative?: boolean }): Observable<string[]> {
        return this.ipcService.sendV2("get-linked-folders", { args: { version, options } });
    }

    public relinkAllVersionsFolders(): Observable<void> {
        return this.ipcService.sendV2("relink-all-versions-folders");
    }

    public $isVersionFolderPending(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.queue$.pipe(
            mergeMap(async queue => {
                return queue.some(q => q.relativeFolder.includes(relativeFolder) && equal(q.version, version));
            }),
            distinctUntilChanged(),
            shareReplay(1)
        );
    }

    public get currentAction$(): Observable<VersionLinkerAction> {
        return this._queue$.pipe(
            map(actions => actions.at(0)),
            distinctUntilChanged()
        );
    }

    public get queue$(): Observable<VersionLinkerAction[]> {
        return this._queue$.asObservable();
    }
}

export const enum VersionLinkerActionType {
    Link = "link",
    Unlink = "unlink",
}

export interface VersionLinkerAction {
    version: BSVersion;
    relativeFolder: string;
    type: VersionLinkerActionType;
    options?: LinkOptions;
}

export interface VersionLinkFolderAction extends VersionLinkerAction {
    type: VersionLinkerActionType.Link;
}

export interface VersionUnlinkFolderAction extends VersionLinkerAction {
    type: VersionLinkerActionType.Unlink;
    options?: UnlinkOptions;
}

export type VersionLinkerActionListener = (action: VersionLinkerAction, linked: boolean) => void;
