import fs from "fs-extra";
import log from "electron-log";
import path from "path";
import { BS_APP_ID, IS_FLATPAK, PROTON_BINARY_PREFIX, WINE_BINARY_PREFIX } from "main/constants";
import { StaticConfigurationService } from "./static-configuration.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSLaunchError, LaunchOption } from "shared/models/bs-launch";
import { app } from "electron";
import config from "../../../electron-builder.config";
import { bsmExec } from "main/helpers/os.helpers";

export class LinuxService {
    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly staticConfig: StaticConfigurationService;
    private protonPrefix = "";

    private nixOS: boolean | undefined;

    private constructor() {
        this.staticConfig = StaticConfigurationService.getInstance();
    }

    // === Launching === //

    public async setupLaunch(
        launchOptions: LaunchOption,
        steamPath: string,
        bsFolderPath: string,
        env: Record<string, string>
    ) {
        if (launchOptions.admin) {
            log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
            launchOptions.admin = false;
        }

        // Create the compat data path if it doesn't exist.
        // If the user never ran Beat Saber through steam before
        // using bsmanager, it won't exist, and proton will fail
        // to launch the game.
        const compatDataPath = `${steamPath}/steamapps/compatdata/${BS_APP_ID}`;
        if (!fs.existsSync(compatDataPath)) {
            log.info(`Proton compat data path not found at '${compatDataPath}', creating directory`);
            fs.mkdirSync(compatDataPath);
        }

        if (!this.staticConfig.has("proton-folder")) {
            throw CustomError.fromError(
                new Error("Proton folder not set"),
                BSLaunchError.PROTON_NOT_SET
            );
        }
        const protonPath = path.join(
            this.staticConfig.get("proton-folder"),
            PROTON_BINARY_PREFIX
        );
        if (!fs.pathExistsSync(protonPath)) {
            throw CustomError.fromError(
                new Error("Could not locate proton binary"),
                BSLaunchError.PROTON_NOT_FOUND
            );
        }

        this.protonPrefix = await this.isNixOS()
            ? `steam-run "${protonPath}" run`
            : `"${protonPath}" run`;

        // Setup Proton environment variables
        Object.assign(env, {
            "WINEDLLOVERRIDES": "winhttp=n,b", // Required for mods to work
            "STEAM_COMPAT_DATA_PATH": compatDataPath,
            "STEAM_COMPAT_INSTALL_PATH": bsFolderPath,
            "STEAM_COMPAT_CLIENT_INSTALL_PATH": steamPath,
            "STEAM_COMPAT_APP_ID": BS_APP_ID,
            // Run game in steam environment; fixes #585 for unicode song titles
            "SteamEnv": "1",
            // Uncomment these to create a proton log file in the Beat Saber install directory.
            // "PROTON_LOG": 1,
            // "PROTON_LOG_DIR": bsFolderPath,
        });
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
        return fs.pathExistsSync(protonPath) && fs.pathExistsSync(winePath);
    }

    public getWinePath(): string {
        if (!this.staticConfig.has("proton-folder")) {
            throw new Error("proton-folder variable not set");
        }

        const winePath = path.join(
            this.staticConfig.get("proton-folder"),
            WINE_BINARY_PREFIX
        );
        if (!fs.pathExistsSync(winePath)) {
            throw new Error(`"${winePath}" binary file not found`);
        }

        return winePath;
    }

    public getProtonPrefix(): string {
        // Set in setupLaunch
        return this.protonPrefix;
    }

    // === Flatpak Specific === //

    public getFlatpakLocalVersionFolder(): string {
        return path.join(
            app.getPath("home"),
            ".var", "app", config.appId,
            "resources", "assets", "jsons"
        );
    }

    // === NixOS Specific === //

    private async isNixOS(): Promise<boolean> {
        if (this.nixOS !== undefined) {
            return this.nixOS;
        }

        try {
            await bsmExec("nixos-version", {
                log: true,
                flatpak: { host: IS_FLATPAK },
            });
            this.nixOS = true;
        } catch (error) {
            log.info("Not NixOS", error);
            this.nixOS = false;
        }

        return this.nixOS;
    }
}
