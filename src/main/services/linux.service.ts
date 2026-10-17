import fs from "fs-extra";
import log from "electron-log";
import path from "path";
import { IS_FLATPAK } from "main/constants";
import { InstallationLocationService } from "./installation-location.service";
import { StaticConfigurationService } from "./static-configuration.service";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { BSLaunchError } from "shared/models/bs-launch";
import { BsmShellLog, bsmExec } from "main/helpers/os.helpers";
import { buildLinuxDesktopEntry } from "main/helpers/launch-shortcut.helpers";
import { ModsGridStatus } from "shared/models/mods/mod-ipc.model";
import { ProtonConfig } from "./bs-launcher/game-runtime";

type ProtonPurpose = "game" | "prefix";

export class LinuxService {
    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly PROTON_BINARY_PREFIX = "proton";
    // x86_64 Proton uses wine64; ARM64 Proton uses the unified Wine binary.
    // https://github.com/Zagrios/bs-manager/pull/586#issuecomment-2449228826
    private readonly WINE_BINARY_PREFIXES = [
        path.join("files", "bin", "wine64"),
        path.join("files", "lib", "wine", "x86_64-unix", "wine64"),
        path.join("files", "bin-arm64", "wine"),
    ];

    private readonly installLocationService: InstallationLocationService;
    private readonly staticConfig: StaticConfigurationService;

    private nixOS: boolean | undefined;
    private winePath = "";

    private constructor() {
        this.installLocationService = InstallationLocationService.getInstance();
        this.staticConfig = StaticConfigurationService.getInstance();
    }

    // === Launching === //

    private getCompatDataPath() {
        const sharedFolder = this.installLocationService.sharedContentPath();
        return path.resolve(sharedFolder, "compatdata");
    }

    public async getProtonConfig(
        steamPath: string,
        options: { createCompatData: boolean }
    ): Promise<ProtonConfig> {
        return this.buildProtonConfig(steamPath, options, "game");
    }

    public async getPrefixProtonConfig(
        steamPath: string,
        options: { createCompatData: boolean }
    ): Promise<ProtonConfig> {
        return this.buildProtonConfig(steamPath, options, "prefix");
    }

    private async buildProtonConfig(
        steamPath: string,
        options: { createCompatData: boolean },
        purpose: ProtonPurpose
    ): Promise<ProtonConfig> {
        const compatDataPath = this.getCompatDataPath();
        if (options.createCompatData && !fs.existsSync(compatDataPath)) {
            // If the user never ran Beat Saber through steam before
            // using bsmanager, it won't exist, and proton will fail
            // to launch the game.
            log.info(`Proton compat data path not found at '${compatDataPath}', creating directory`);
            await fs.ensureDir(compatDataPath);
        }

        const protonPath = this.getProtonPath(purpose);
        const nixOS = await this.isNixOS();

        if (!options.createCompatData && !fs.existsSync(compatDataPath)) {
            throw new CustomError("Could not find BSManager WINEPREFIX path", ModsGridStatus.NO_WINEPREFIX);
        }

        return { protonPath, compatDataPath, steamPath, nixOS };
    }

    private getOptionalPrefixProtonFolder(): string | undefined {
        if (!this.staticConfig.has("prefix-proton-folder")) {
            return undefined;
        }

        const configured = this.staticConfig.get("prefix-proton-folder");
        if (typeof configured !== "string") {
            return undefined;
        }

        const trimmed = configured.trim();
        return trimmed || undefined;
    }

    private resolveProtonFolder(purpose: ProtonPurpose): string {
        if (purpose === "prefix") {
            const prefixFolder = this.getOptionalPrefixProtonFolder();
            if (prefixFolder) {
                return prefixFolder;
            }
        }

        if (!this.staticConfig.has("proton-folder")) {
            throw CustomError.fromError(
                new Error("Proton folder not set"),
                BSLaunchError.PROTON_NOT_SET
            );
        }

        return this.staticConfig.get("proton-folder");
    }

    private getProtonPath(purpose: ProtonPurpose = "game"): string {
        const protonFolder = this.resolveProtonFolder(purpose);
        const protonPath = path.join(protonFolder, this.PROTON_BINARY_PREFIX);
        if (!fs.pathExistsSync(protonPath)) {
            throw CustomError.fromError(
                new Error("Could not locate proton binary"),
                BSLaunchError.PROTON_NOT_FOUND
            );
        }

        return protonPath;
    }

    public async setProtonFolder(protonFolder: string): Promise<boolean> {
        const trimmedProtonFolder = protonFolder.trim();
        if (!trimmedProtonFolder || !this.verifyProtonPath(trimmedProtonFolder)) {
            return false;
        }

        await this.staticConfig.set("proton-folder", trimmedProtonFolder);
        return true;
    }

    public async setPrefixProtonFolder(protonFolder: string): Promise<boolean> {
        const trimmedProtonFolder = protonFolder.trim();
        if (!trimmedProtonFolder) {
            this.staticConfig.delete("prefix-proton-folder");
            return true;
        }

        if (!this.verifyProtonPath(trimmedProtonFolder)) {
            return false;
        }

        await this.staticConfig.set("prefix-proton-folder", trimmedProtonFolder);
        return true;
    }

    public verifyProtonPath(protonFolder: string = ""): boolean {
        if (protonFolder === "") {
            if (!this.staticConfig.has("proton-folder")) {
                return false;
            }

            protonFolder = this.staticConfig.get("proton-folder");
        }

        // Check if the proton binary exists
        const protonPath = path.join(protonFolder, this.PROTON_BINARY_PREFIX);
        if (!this.isExecutableFile(protonPath)) {
            return false;
        }

        // Check if any wine64 here exists
        for (const winePath of this.WINE_BINARY_PREFIXES) {
            if (this.isExecutableFile(path.join(protonFolder, winePath))) {
                // Reset this, in the case where the user reselects a new proton folder
                this.winePath = "";
                return true;
            }
        }
        return false;
    }

    private isExecutableFile(filePath: string): boolean {
        try {
            if (!fs.pathExistsSync(filePath) || !fs.statSync(filePath).isFile()) {
                return false;
            }

            fs.accessSync(filePath, fs.constants.X_OK);
            return true;
        } catch {
            return false;
        }
    }

    public getWinePath(): string {
        if (this.winePath) {
            return this.winePath;
        }

        if (!this.staticConfig.has("proton-folder")) {
            throw new Error("proton-folder variable not set");
        }

        const protonFolder = this.staticConfig.get("proton-folder");
        const winePath = this.WINE_BINARY_PREFIXES
            .map(prefix => path.join(protonFolder, prefix))
            .find(candidate => fs.pathExistsSync(candidate));

        if (!winePath) {
            throw new Error(`Wine binary file not found in "${protonFolder}"`);
        }

        this.winePath = winePath;
        return winePath;
    }

    // Should be different from winePath, this is the "WINEPREFIX" env var
    //   that points to the wine windows files directory
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

    public async createDesktopShortcut(
        shortcutPath: string,
        name: string,
        icon: string,
        launchLink: string
    ): Promise<boolean> {
        try {
            const desktopEntry = buildLinuxDesktopEntry(name, icon, launchLink);

            await fs.writeFile(shortcutPath, desktopEntry);
            log.info("Created shorcut at ", `"${shortcutPath}/${name}"`);
            return true;
        } catch (error) {
            log.error("Could not create shortcut", error);
            return false;
        }
    }

}
