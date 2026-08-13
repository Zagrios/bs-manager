import { UtilsService } from "./utils.service";
import path from "path";
import { writeFile } from "fs/promises";
import { BSVersion } from "shared/bs-version.interface";
import { RequestService } from "./request.service";
import { readJSON } from "fs-extra";
import { StaticConfigurationService } from "./static-configuration.service";
import equal from "fast-deep-equal";
import log from "electron-log";
import { Observable, concat, defer, filter } from "rxjs";

function isBSVersion(value: unknown): value is BSVersion {
    return (
        typeof value === "object"
        && value !== null
        && "BSVersion" in value
        && typeof value.BSVersion === "string"
        && value.BSVersion.length > 0
    );
}

function isBSVersionCatalog(value: unknown): value is BSVersion[] {
    return Array.isArray(value) && value.every(isBSVersion);
}

export class BSVersionLibService {
    private readonly REMOTE_BS_VERSIONS_URL: string = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/bs-versions.json";
    private readonly REMOTE_BS_VERSIONS_TIMEOUT = 15_000;
    private readonly VERSIONS_FILE: string = "bs-versions.json";

    private static instance: BSVersionLibService;

    private readonly utilsService: UtilsService;
    private readonly requestService: RequestService;
    private readonly configService: StaticConfigurationService;

    private cachedVersions: BSVersion[] | null = null;
    private loadPromise: Promise<BSVersion[]> | null = null;
    private refreshPromise: Promise<BSVersion[] | null> | null = null;

    private constructor() {
        this.utilsService = UtilsService.getInstance();
        this.requestService = RequestService.getInstance();
        this.configService = StaticConfigurationService.getInstance();
    }

    public static getInstance(): BSVersionLibService {
        if (!BSVersionLibService.instance) {
            BSVersionLibService.instance = new BSVersionLibService();
        }
        return BSVersionLibService.instance;
    }

    private async getRemoteVersions(signal: AbortSignal): Promise<unknown> {
        const response = await this.requestService.getJSON<unknown>(this.REMOTE_BS_VERSIONS_URL, {
            signal,
            retryLimit: 0,
        });
        return response.data;
    }

    private getVersionsFilePath(): string {
        return path.join(this.utilsService.getAssestsJsonsPath(), this.VERSIONS_FILE);
    }

    private async getLocalVersions(): Promise<unknown> {
        const localVersionsPath = this.getVersionsFilePath();

        if (process.platform !== "linux") {
            return readJSON(localVersionsPath);
        }

        let versions = this.configService.get("versions");
        if (!versions?.length) {
            versions = await readJSON(localVersionsPath);
        }
        return versions;
    }

    private async updateLocalVersions(versions: BSVersion[]): Promise<void> {
        if (process.platform === "linux") {
            await this.configService.set("versions", versions);
            return;
        }

        await writeFile(this.getVersionsFilePath(), JSON.stringify(versions, null, "\t"), { encoding: "utf-8", flag: "w" });
    }

    public getCachedVersions(): Promise<BSVersion[]> {
        if (this.cachedVersions !== null) {
            return Promise.resolve(this.cachedVersions);
        }

        if (this.loadPromise === null) {
            this.loadPromise = this.getLocalVersions()
                .then(versions => {
                    if (!isBSVersionCatalog(versions)) {
                        log.error("Ignoring an invalid local Beat Saber versions catalog");
                        this.cachedVersions = [];
                        return this.cachedVersions;
                    }

                    this.cachedVersions = versions;
                    return this.cachedVersions;
                })
                .catch(error => {
                    log.error("Unable to load the local Beat Saber versions catalog", error);
                    this.cachedVersions = [];
                    return this.cachedVersions;
                })
                .finally(() => {
                    this.loadPromise = null;
                });
        }

        return this.loadPromise;
    }

    private async refreshCachedVersions(): Promise<BSVersion[] | null> {
        await this.getCachedVersions();

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), this.REMOTE_BS_VERSIONS_TIMEOUT);

        try {
            const remoteVersions = await this.getRemoteVersions(abortController.signal);
            if (!isBSVersionCatalog(remoteVersions) || remoteVersions.length === 0) {
                log.warn("Ignoring an empty or invalid remote Beat Saber versions catalog");
                return null;
            }

            if (equal(this.cachedVersions, remoteVersions)) {
                return null;
            }

            this.cachedVersions = remoteVersions;
            await this.updateLocalVersions(remoteVersions).catch(error => {
                log.warn("Unable to persist the remote Beat Saber versions catalog", error);
            });

            return remoteVersions;
        } catch (error) {
            log.warn("Unable to refresh the remote Beat Saber versions catalog", error);
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    private refreshAvailableVersions(): Promise<BSVersion[] | null> {
        if (this.refreshPromise === null) {
            this.refreshPromise = this.refreshCachedVersions().finally(() => {
                this.refreshPromise = null;
            });
        }

        return this.refreshPromise;
    }

    public getAvailableVersions$(refresh = false): Observable<BSVersion[]> {
        const cachedVersions$ = defer(() => this.getCachedVersions());
        if (!refresh) {
            return cachedVersions$;
        }

        const refreshedVersions$ = defer(() => this.refreshAvailableVersions()).pipe(
            filter((versions): versions is BSVersion[] => versions !== null)
        );

        return concat(cachedVersions$, refreshedVersions$);
    }

    public async getVersionDetails(version: string): Promise<BSVersion> {
        const versions = await this.getCachedVersions();
        return versions.find(v => v.BSVersion === version);
    }
}
