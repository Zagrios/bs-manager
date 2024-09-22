import path from "path";
import { StaticConfigurationService } from "./static-configuration.service";
import { pathExistsSync } from "fs-extra";
import { PROTON_BINARY_PREFIX, WINE_BINARY_PREFIX } from "main/constants";


// Linux handling
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

    public verifyProtonPath(): boolean {
        if (!this.staticConfig.has("proton-folder")) {
            return false;
        }

        const protonFolder = this.staticConfig.get("proton-folder");
        const protonPath = path.join(protonFolder, PROTON_BINARY_PREFIX);
        const winePath = path.join(protonFolder, WINE_BINARY_PREFIX);

        return pathExistsSync(protonPath) && pathExistsSync(winePath);
    }

}
