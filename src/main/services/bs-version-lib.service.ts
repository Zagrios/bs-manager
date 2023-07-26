import { UtilsService } from "./utils.service";
import path from "path";
import { writeFileSync } from "fs";
import { BSVersion } from "shared/bs-version.interface";
import { RequestService } from "./request.service";
import { readJSON } from "fs-extra";
import { allSettled } from "../../shared/helpers/promise.helpers";

export class BSVersionLibService {
    private readonly REMOTE_BS_VERSIONS_URL: string = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/bs-versions.json";
    private readonly VERSIONS_FILE: string = "bs-versions.json";

    private static instance: BSVersionLibService;

    private utilsService: UtilsService;
    private requestService: RequestService;

    private bsVersions: BSVersion[];

    private constructor() {
        this.utilsService = UtilsService.getInstance();
        this.requestService = RequestService.getInstance();
    }

    public static getInstance(): BSVersionLibService {
        if (!BSVersionLibService.instance) {
            BSVersionLibService.instance = new BSVersionLibService();
        }
        return BSVersionLibService.instance;
    }

    private getRemoteVersions(): Promise<BSVersion[]> {
        return this.requestService.getJSON<BSVersion[]>(this.REMOTE_BS_VERSIONS_URL);
    }

    private async getLocalVersions(): Promise<BSVersion[]> {
        const localVersionsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.VERSIONS_FILE);
        return readJSON(localVersionsPath);
    }

    private async updateLocalVersions(versions: BSVersion[]): Promise<void> {
        const localVersionsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.VERSIONS_FILE);
        writeFileSync(localVersionsPath, JSON.stringify(versions, null, "\t"), { encoding: "utf-8", flag: "w" });
    }

    private async loadBsVersions(): Promise<BSVersion[]> {
        if (this.bsVersions) {
            return this.bsVersions;
        }

        const [localVersions, remoteVersions] = await allSettled([this.getLocalVersions(), this.getRemoteVersions()], { keepStructure: true });

        let resVersions = localVersions;
        if (remoteVersions?.length) {
            resVersions = remoteVersions;
            this.updateLocalVersions(resVersions);
        }
        this.bsVersions = resVersions;
        return this.bsVersions;
    }

    public async getAvailableVersions(): Promise<BSVersion[]> {
        const bsVersions = await this.loadBsVersions();
        if (!bsVersions?.length) {
            return [];
        }
        return bsVersions;
    }

    public async getVersionDetails(version: string): Promise<BSVersion> {
        const versions = await this.getAvailableVersions();
        return versions.find(v => v.BSVersion === version);
    }
}
