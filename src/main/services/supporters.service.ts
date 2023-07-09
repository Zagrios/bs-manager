import { writeFileSync } from "fs";
import { readJSON } from "fs-extra";
import path from "path";
import { Supporter } from "shared/models/supporters/supporter.interface";
import { UtilsService } from "./utils.service";
import { RequestService } from "./request.service";
import { allSettled } from "../../shared/helpers/promise.helpers";

export class SupportersService {
    private readonly PATREONS_URL = "https://raw.githubusercontent.com/Zagrios/bs-manager/master/assets/jsons/patreons.json";
    private readonly PATREONS_FILE = "patreons.json";

    private static instance: SupportersService;

    private cache: Supporter[];

    private readonly utilsService: UtilsService;
    private readonly requestService: RequestService;

    public static getInstance(): SupportersService {
        if (!SupportersService.instance) {
            SupportersService.instance = new SupportersService();
        }
        return SupportersService.instance;
    }

    private constructor() {
        this.utilsService = UtilsService.getInstance();
        this.requestService = RequestService.getInstance();
    }

    private async updateLocalSupporters(supporters: Supporter[]): Promise<void> {
        const patreonsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.PATREONS_FILE);
        writeFileSync(patreonsPath, JSON.stringify(supporters, null, "\t"), { encoding: "utf-8", flag: "w" });
    }

    private getRemoteSupporters(): Promise<Supporter[]> {
        return this.requestService.getJSON(this.PATREONS_URL);
    }

    private async getLocalSupporters(): Promise<Supporter[]> {
        const patreonsPath = path.join(this.utilsService.getAssestsJsonsPath(), this.PATREONS_FILE);
        return readJSON(patreonsPath);
    }

    private async loadSupporters(): Promise<Supporter[]> {
        if (!!this.cache && this.cache.length) {
            return this.cache;
        }

        const [localVersions, remoteVersions] = await allSettled([this.getLocalSupporters(), this.getRemoteSupporters()], { keepStructure: true });

        const supporters = remoteVersions?.length ? remoteVersions : localVersions;

        if (!!remoteVersions && remoteVersions.length) {
            this.updateLocalSupporters(remoteVersions);
        }

        this.cache = supporters;
        return this.cache;
    }

    public getSupporters(): Promise<Supporter[]> {
        return this.loadSupporters();
    }
}
