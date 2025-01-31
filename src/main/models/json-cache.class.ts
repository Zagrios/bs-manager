import { pathExistsSync, readFileSync } from "fs-extra";
import { writeFileSync } from "../helpers/fs.helpers";
import { tryit } from "shared/helpers/error.helpers";
import log from "electron-log";
import { Subject, debounceTime } from "rxjs";

export class JsonCache<T = unknown> {

    private _cache: Record<string, T> = {};
    private readonly setEvent: Subject<void> = new Subject<void>();

    public constructor(
        private readonly jsonPath: string,
        private readonly options: JsonCacheOptions = { autoSave: true, saveDebounce: 1000}
    ){
        this.load();

        if(this.options.autoSave){
            this.setEvent = new Subject<void>();
            this.setEvent.pipe(debounceTime(this.options.saveDebounce ?? 1000)).subscribe(() => this.save());
        }
    }

    private load(): void {
        try {
            if(pathExistsSync(this.jsonPath)){
                this._cache = JSON.parse(readFileSync(this.jsonPath).toString());
            } else {
                log.warn("File cache not exist yet", this.jsonPath);
            }
        } catch (error) {
            log.warn("Failed to load cache file", this.jsonPath, error);
        } finally {
            this._cache ??= {};
        }
    }

    public save(): void {
        const res = tryit(() => writeFileSync(this.jsonPath, JSON.stringify(this._cache), { flush: true }));
        if(res.error){
            log.error("Failed to save cache", this.jsonPath, res.error);
        }
    }

    public get(key: string): T {
        return this._cache[key];
    }

    public set(key: string, value: T): void {
        this._cache[key] = value;
        this.setEvent?.next();
    }

    public delete(key: string): void {
        delete this._cache[key];
        this.setEvent?.next();
    }

    public clear(): void {
        this._cache = {};
        this.setEvent?.next();
    }

    public get cache(): Record<string, T> {
        return this._cache;
    }
}

export type JsonCacheOptions = {
    /**
     * Load the cache immediately after creating the instance
     * @default true
     */
    loadImmediately?: boolean;
    /**
     * Auto save the cache after a change
     * @default true
     */
    autoSave?: boolean;
    /**
     * Time in ms to wait before saving the cache after a change
     * @default 1000
     */
    saveDebounce?: number;
};
