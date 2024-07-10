import path from "path";
import { ensureDirSync, existsSync, readFile, writeFile } from "fs-extra";
import { BehaviorSubject, Observable, catchError, filter, lastValueFrom, of, take, timeout } from "rxjs";
import { ConfigurationService } from "../../configuration.service";
import { RequestService } from "../../request.service";
import { tryit } from "shared/helpers/error.helpers";
import { CACHE_PATH, HTTP_STATUS_CODES } from "main/constants";
import log from "electron-log";
import protobuf from "protobufjs";
import { UtilsService } from "../../utils.service";
import { SongDetails } from "shared/models/maps/song-details-cache/song-details-cache.model";
import { inflate } from "pako";
import { RawSongDetailsCache } from "shared/models/maps/song-details-cache/raw-song-details-cache.model";
import { RawSongDetailsDeserializer } from "shared/models/maps/song-details-cache/raw-song-details-deserializer.class";

export class SongDetailsCacheService {

    private static instance: SongDetailsCacheService;

    public static getInstance(): SongDetailsCacheService {
        if (!SongDetailsCacheService.instance) {
            SongDetailsCacheService.instance = new SongDetailsCacheService();
        }
        return SongDetailsCacheService.instance;
    }

    private readonly dataSource = [
        "https://raw.githubusercontent.com/Zagrios/beat-saber-scraped-maps/master/song_details_cache_v1.gz",
		"https://cdn.jsdelivr.net/gh/Zagrios/beat-saber-scraped-maps@master/song_details_cache_v1.gz",
    ]

    private readonly PROTO_CACHE_PATH = path.join(CACHE_PATH, "song-details-cache");
    private readonly etagKey = "song-details-cache-etag";

    private readonly config: ConfigurationService;
    private readonly request: RequestService;
    private readonly utils: UtilsService;

    private songDetailsCache: Record<string, SongDetails> = {};
    private songDetailsIdIndex: Record<string, SongDetails> = {};
    private readonly _loaded$ = new BehaviorSubject<boolean>(null);

    private constructor(){
        this.config = ConfigurationService.getInstance();
        this.request = RequestService.getInstance();
        this.utils = UtilsService.getInstance();
        this.loadCache()
    }

    private async loadCache(): Promise<void> {
        const protoCacheExists = existsSync(this.PROTO_CACHE_PATH);
        const etag = protoCacheExists ? this.config.get<string>(this.etagKey) : null;

        await this.downloadCacheFile(etag).then(etag => {
            this.config.set(this.etagKey, etag);
            log.info("SongDetailsCache downloaded");
            this.songDetailsIdIndex = this.createIdIndex(this.songDetailsCache);
            log.info("SongDetailsIdIndex created");
        }).catch(err => {
            log.error("Unable to download cache file", err);
        });

        this.readProtoMessageCacheFile(this.PROTO_CACHE_PATH).then(cache => {
            this.songDetailsCache = cache;
            log.info("SongDetailsCache loaded");
        }).catch(err => {
            log.error("Failed to read cache file", this.PROTO_CACHE_PATH, err);
        }).finally(() => {
            this._loaded$.next(true);
        })
    }

    private createIdIndex(songDetailsCache: Record<string, SongDetails>): Record<string, SongDetails> {
        const res: Record<string, SongDetails> = {};
        // eslint-disable-next-line guard-for-in
        for(const hash in songDetailsCache){
            res[songDetailsCache[hash].id] = songDetailsCache[hash];
        }
        return res;
    }

    private async readProtoMessageCacheFile(filePath: string): Promise<Record<string, SongDetails>> {
        const protobufRoot = protobuf.loadSync(this.getProtoShemaPath());
        const cacheMessage = protobufRoot.lookupType("SongDetailsCache");

        const buffer = await readFile(filePath);

        const messageBuffer = cacheMessage.decode(buffer);
        const messageObj = cacheMessage.toObject(messageBuffer) as RawSongDetailsCache;

        const res: Record<string, SongDetails> = {};

        RawSongDetailsDeserializer.setUploadersList(messageObj.uploaders);
        RawSongDetailsDeserializer.setDifficultyLabels(messageObj.difficultyLabels);

        for(const rawSong of messageObj.songs){
            const deserialized = RawSongDetailsDeserializer.deserialize(rawSong);
             res[deserialized.hash.toLowerCase()] = deserialized;
        }

        return res;
    }

    /**
     * Download the GZipped Proto file and write it to the cache destination
     * @param etag
     * @returns {string} new etag or the same if the file is the same
     */
    private async downloadCacheFile(etag?: string): Promise<string> {
        const { buffer, etag: newEtag } = await this.downloadGZCacheFile(etag);

        if(!buffer) { return etag; }

        ensureDirSync(path.dirname(this.PROTO_CACHE_PATH));

        await writeFile(this.PROTO_CACHE_PATH, inflate(buffer), { encoding: "binary" });

        return newEtag;
    }

    /**
     * Download the GZipped Proto file from the sources
     * @returns {Promise<{ buffer: Buffer, etag: string }>} {\
     *     buffer: GZipper Buffer, will be empty if etag is the same\
     *     etag: ETag of the file, should be never empty\
     * }
     */
    private async downloadGZCacheFile(etag?: string): Promise<{ buffer: Buffer, etag: string }> {

        let lastError: Error;

        for(const sourceUrl of this.dataSource){

            const { result, error } = await tryit(() => {
                return lastValueFrom(this.request.downloadBuffer(sourceUrl, {
                    headers: etag ? { "If-None-Match": etag } : {},
                    decompress: false
                })).then(res => ({ buffer: res.data, request: res.extra}));
            });


            if(error) {
                lastError = error;
                continue;
            }

            log.info("Downloaded SongDetailCache file from source:", sourceUrl, "ETAG:", result.request.headers.etag, result.request.statusCode);

            return {
                buffer: result.request.statusCode === HTTP_STATUS_CODES.HTTP_STATUS_NOT_MODIFIED ? null : result.buffer,
                etag: result.request.headers.etag
            }
        }

        log.error("Failed to download SongDetailCache file", etag, lastError);
        throw lastError;
    }

    private getProtoShemaPath(): string {
        return this.utils.getAssetsPath(path.join("proto", "song_details_cache_v1.proto"))
    }

    public get loaded$(): Observable<boolean> {
        return this._loaded$.pipe(filter(val => typeof val === "boolean"));
    }

    /**
     * Promise that resolves when the cache is loaded (loaded does not mean cache contains data, just the all load process is done)
     * @param timeoutMs in milliseconds
     * @throws {TimeoutError} if the cache is not ready after the provided timeout
     */
    public waitLoaded(timeoutMs: number): Promise<boolean> {

        const obs = this.loaded$.pipe(take(1));

        return lastValueFrom(obs.pipe(timeout(timeoutMs), catchError((err => {
            log.error("Wait loaded SongDetailsCache timed out", err);
            return of(false);
        }))));
    }

    public getSongDetails(hash: string): SongDetails | undefined {
        return this.songDetailsCache[hash.toLowerCase()];
    }

    public getSongDetailsById(id: string): SongDetails | undefined {
        return this.songDetailsIdIndex[id.toLowerCase()];
    }

}
