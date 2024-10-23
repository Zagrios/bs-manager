import log from "electron-log";
import path from "path";
import { pathExistsSync } from "fs-extra";
import { PROTON_BINARY_PREFIX } from "main/constants";
import { exec } from "child_process";
import { StaticConfigurationService } from "./static-configuration.service";

export class LinuxService {
    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly WINE_BINARY_PREFIX = path.join("files", "bin", "wine");

    private readonly staticConfig: StaticConfigurationService;

    private winePath = "";

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
        return pathExistsSync(protonPath);
    }

    public async getWinePath(): Promise<string> {
        if (this.winePath) {
            return this.winePath;
        }

        return new Promise((resolve, reject) => {
            // Get the default installed wine
            exec("wine --version", (error, stdout) => {
                if (!error) {
                    log.info("found", stdout);
                    this.winePath = "wine";
                    return resolve("wine");
                }

                log.warn("wine is not installed, falling back to proton's wine binary");
                log.warn("wine warn:", error);

                // Fallback to the use the wine bundled in proton
                if (!this.staticConfig.has("proton-folder")) {
                    return reject(new Error("proton folder not in configuration setup"));
                }

                const tmpWinePath = path.join(this.staticConfig.get("proton-folder"), this.WINE_BINARY_PREFIX);
                if (!pathExistsSync(tmpWinePath)) {
                    return reject(new Error("wine binary not in proton folder"));
                }

                this.winePath = tmpWinePath;
                resolve(this.winePath);
            });
        });
    }
}
