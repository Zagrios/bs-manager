import path from "path";
import { pathExistsSync } from "fs-extra";
import { PROTON_BINARY_PREFIX, WINE_BINARY_PREFIX } from "main/constants";
import { StaticConfigurationService } from "./static-configuration.service";

export class LinuxService {
    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly staticConfig: StaticConfigurationService;

    private constructor() {
        this.staticConfig = StaticConfigurationService.getInstance();
    }

    public verifyProtonPath(protonFolder: string = ""): boolean {
        if (protonFolder === "") {
            if (!this.staticConfig.has("proton-folder")) {
                return false;
            }

            protonFolder = this.staticConfig.get("proton-folder");
        }

        const protonPath = path.join(protonFolder, PROTON_BINARY_PREFIX);
        const winePath = path.join(protonFolder, WINE_BINARY_PREFIX);
        return pathExistsSync(protonPath) && pathExistsSync(winePath);
    }

    public getWinePath(): string {
        if (!this.staticConfig.has("proton-folder")) {
            throw new Error("proton-folder variable not set");
        }

        const winePath = path.join(
            this.staticConfig.get("proton-folder"),
            WINE_BINARY_PREFIX
        );
        if (!pathExistsSync(winePath)) {
            throw new Error(`"${winePath}" binary file not found`);
        }

        return winePath;
    }
}
