import fs from "fs-extra";
import log from "electron-log";
import path from "path";
import { BS_APP_ID, BS_EXECUTABLE, IS_FLATPAK, PROTON_BINARY_PREFIX, WINE_BINARY_PREFIX } from "main/constants";
import { InstallationLocationService } from "./installation-location.service";
import { StaticConfigurationService } from "./static-configuration.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSLaunchError, LaunchOption } from "shared/models/bs-launch";
import { BsmShellLog, bsmExec } from "main/helpers/os.helpers";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { SteamShortcutData } from "shared/models/steam/shortcut.model";
import { buildBsLaunchArgs } from "./bs-launcher/abstract-launcher.service";

export class LinuxService {
    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly installLocationService: InstallationLocationService;
    private readonly staticConfig: StaticConfigurationService;

    private nixOS: boolean | undefined;

    private constructor() {
        this.installLocationService = InstallationLocationService.getInstance();
        this.staticConfig = StaticConfigurationService.getInstance();
    }

    // === Launching === //

    private getCompatDataPath() {
        const sharedFolder = this.installLocationService.sharedContentPath();
        return path.resolve(sharedFolder, "compatdata");
    }

    public async setupLaunch(
        launchOptions: LaunchOption,
        steamPath: string,
        bsFolderPath: string
    ): Promise<{
        protonPrefix: string;
        env: Record<string, string>;
    }> {
        if (launchOptions.admin) {
            log.warn("Launching as admin is not supported on Linux! Starting the game as a normal user.");
            launchOptions.admin = false;
        }

        const protonPath = await this.getProtonPath();
        return {
            protonPrefix: await this.isNixOS()
                ? `steam-run "${protonPath}" run`
                : `"${protonPath}" run`,
            env: await this.buildEnvVariables(launchOptions, steamPath, bsFolderPath)
        };
    }

    private async getProtonPath(): Promise<string> {
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

        return protonPath;
    }

    private async buildEnvVariables(
        launchOptions: LaunchOption,
        steamPath: string,
        bsFolderPath: string
    ): Promise<Record<string, string>> {
        // Create the compat data path if it doesn't exist.
        // If the user never ran Beat Saber through steam before
        // using bsmanager, it won't exist, and proton will fail
        // to launch the game.
        const compatDataPath = this.getCompatDataPath();
        if (!fs.existsSync(compatDataPath)) {
            log.info(`Proton compat data path not found at '${compatDataPath}', creating directory`);
            fs.mkdirSync(compatDataPath);
        }

        // Setup Proton environment variables
        const envVars: Record<string, string> = {
            "WINEDLLOVERRIDES": "winhttp=n,b", // Required for mods to work
            "STEAM_COMPAT_DATA_PATH": compatDataPath,
            "STEAM_COMPAT_INSTALL_PATH": bsFolderPath,
            "STEAM_COMPAT_CLIENT_INSTALL_PATH": steamPath,
            "STEAM_COMPAT_APP_ID": BS_APP_ID,
            // Run game in steam environment; fixes #585 for unicode song titles
            "SteamEnv": "1",
        };

        if (launchOptions.launchMods?.includes(LaunchMods.PROTON_LOGS)) {
            envVars.PROTON_LOG = "1";
            envVars.PROTON_LOG_DIR = path.join(bsFolderPath, "Logs");
        }

        return envVars;
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

    public getWinePrefixPath(): string {
        const compatDataPath = this.getCompatDataPath();
        return fs.existsSync(compatDataPath)
            ? path.join(compatDataPath, "pfx") : "";
    }

    // === NixOS Specific === //

    public async isNixOS(): Promise<boolean> {
        if (this.nixOS !== undefined) {
            return this.nixOS;
        }

        try {
            await bsmExec("nixos-version", {
                log: BsmShellLog.Command,
                flatpak: { host: IS_FLATPAK },
            });
            this.nixOS = true;
        } catch (error) {
            log.info("Not NixOS", error);
            this.nixOS = false;
        }

        return this.nixOS;
    }

    // === Shortcuts === //

    private getCommand(
        protonPrefix: string,
        bsFolderPath: string,
        env: Record<string, string>,
        launchOptions: LaunchOption
    ): string {
        const envString = Object.entries(env)
            .map(([ key, value ]) => `${key}="${value}"`)
            .join(" ");
        const bsExe = path.join(bsFolderPath, BS_EXECUTABLE);
        const args = buildBsLaunchArgs(launchOptions).join(" ");
        return `${envString} ${protonPrefix} "${bsExe}" ${args}`;
    }

    public async createDesktopShortcut(
        shortcutPath: string,
        name: string,
        icon: string,
        launchOptions: LaunchOption,
        steamPath: string,
        bsFolderPath: string
    ): Promise<boolean> {
        try {
            const {
                protonPrefix, env
            } = await this.setupLaunch(launchOptions, steamPath, bsFolderPath);

            Object.assign(env, {
                "SteamAppId": BS_APP_ID,
                "SteamOverlayGameId": BS_APP_ID,
                "SteamGameId": BS_APP_ID,
            });

            const command = this.getCommand(
                protonPrefix, bsFolderPath,
                env, launchOptions
            );

            const desktopEntry = [
                "[Desktop Entry]",
                "Type=Application",
                `Name=${name}`,
                `Icon=${icon}`,
                `Path=${bsFolderPath}`,
                `Exec=${command}`
            ].join("\n");

            await fs.writeFile(shortcutPath, desktopEntry);
            log.info("Created shorcut at ", `"${shortcutPath}/${name}"`);
            return true;
        } catch (error) {
            log.error("Could not create shortcut", error);
            return false;
        }
    }

    public async getSteamShortcutData(
        shortcutName: string,
        icon: string,
        launchOptions: LaunchOption,
        steamPath: string,
        bsFolderPath: string
    ): Promise<SteamShortcutData> {
        const env = await this.buildEnvVariables(
            launchOptions, steamPath, bsFolderPath
        );
        Object.assign(env, {
            "SteamAppId": BS_APP_ID,
            "SteamOverlayGameId": BS_APP_ID,
            "SteamGameId": BS_APP_ID,
        });

        const protonPrefix = await this.isNixOS()
            ? "steam-run %command% run"
            : "%command% run";

        return {
            AppName: shortcutName,
            Exe: await this.getProtonPath(),
            StartDir: bsFolderPath,
            icon,
            OpenVR: "\x01",
            LaunchOptions: this.getCommand(
                protonPrefix, bsFolderPath,
                env, launchOptions
            )
        };
    }

}
