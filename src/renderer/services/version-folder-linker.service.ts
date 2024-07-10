import { LinkOptions } from "main/services/folder-linker.service";
import { map, distinctUntilChanged, filter, mergeMap, shareReplay } from "rxjs/operators";
import { BehaviorSubject, Observable, of } from "rxjs";
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
        return this.ipcService.sendV2("link-version-folder-action", action);
    }

    private get currentAction$(): Observable<VersionLinkerAction> {
        return this._queue$.pipe(
            map(actions => actions.at(0)),
            distinctUntilChanged()
        );
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

        this._queue$.next([...this._queue$.value, {...action, type: VersionLinkerActionType.Link}]);

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

        this._queue$.next([...this._queue$.value, {...action, type: VersionLinkerActionType.Unlink}]);

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
        return this.ipcService.sendV2("is-version-folder-linked", { version, relativeFolder });
    }

    public $folderLinkedState(version: BSVersion, relativeFolder: string): Observable<FolderLinkState> {
        return this._queue$.pipe(
            mergeMap(queue => {
                const currentAction = queue.at(0);
                if(currentAction && equal(currentAction.version, version) && currentAction.relativeFolder === relativeFolder) {
                    return of(FolderLinkState.Processing)
                }

                if(queue.some(action => equal(action.version, version) && action.relativeFolder === relativeFolder)) {
                    return of(FolderLinkState.Pending);
                }

                return this.isVersionFolderLinked(version, relativeFolder).pipe(
                    map(linked => linked ? FolderLinkState.Linked : FolderLinkState.Unlinked)
                );
            }),
            distinctUntilChanged(),
            shareReplay(1)
        );
    }

    public $isPending(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.$folderLinkedState(version, relativeFolder).pipe(map(state => state === FolderLinkState.Pending));
    }

    public $isProcessing(version: BSVersion, relativeFolder: string): Observable<boolean> {
        return this.$folderLinkedState(version, relativeFolder).pipe(map(state => state === FolderLinkState.Processing));
    }

    public getLinkedFolders(version: BSVersion, options?: { relative?: boolean }): Observable<string[]> {
        return this.ipcService.sendV2("get-linked-folders", { version, options });
    }

    public relinkAllVersionsFolders(): Observable<void> {
        return this.ipcService.sendV2("relink-all-versions-folders");
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

export type VersionLinkFolderAction = Omit<VersionLinkerAction, "type">;
export type VersionUnlinkFolderAction = Omit<VersionLinkerAction, "type">;

export type VersionLinkerActionListener = (action: VersionLinkerAction, linked: boolean) => void;

export enum FolderLinkState {
    Linked,
    Unlinked,
    Pending,
    Processing
}
