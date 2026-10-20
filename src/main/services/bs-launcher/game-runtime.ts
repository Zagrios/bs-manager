import path from "path";
import { BS_APP_ID } from "main/constants";
import { LaunchMod, LaunchMods } from "shared/models/bs-launch/launch-option.interface";

export type ProtonConfig = {
    protonPath: string;
    compatDataPath: string;
    steamPath: string;
    nixOS: boolean;
};

export interface GameRuntime {
    readonly supportsElevation: boolean;
    runCommand(exePath: string): string;
    prefixCommand(exePath: string): string;
    gameEnv(launchMods: LaunchMod[], gameFolder: string): Record<string, string>;
    prefixEnv(): Record<string, string>;
}

export const windowsNativeRuntime: GameRuntime = {
    supportsElevation: true,
    runCommand: exePath => `"${exePath}"`,
    prefixCommand: exePath => `"${exePath}"`,
    gameEnv: () => ({}),
    prefixEnv: () => ({}),
};

// What the user picked in BSManager's launch mods
function launchModsEnv(launchMods: LaunchMod[], gameFolder: string): Record<string, string> {
    return {
        ...(launchMods.includes(LaunchMods.PROTON_LOGS) ? {
            PROTON_LOG: "1",
            PROTON_LOG_DIR: path.join(gameFolder, "Logs"),
        } : {}),
        ...(launchMods.includes(LaunchMods.PARALLEL_VIEWS) ? { OXR_PARALLEL_VIEWS: "1" } : {}),
    };
}

export function protonRuntime(config: ProtonConfig): GameRuntime {
    const proton = config.nixOS
        ? `steam-run "${config.protonPath}"`
        : `"${config.protonPath}"`;
    const prefixEnv = () => ({
        STEAM_COMPAT_DATA_PATH: config.compatDataPath,
        STEAM_COMPAT_CLIENT_INSTALL_PATH: config.steamPath,
    });

    return {
        supportsElevation: false,
        runCommand: exePath => `${proton} run "${exePath}"`,
        prefixCommand: exePath => `${proton} runinprefix "${exePath}"`,
        prefixEnv,
        gameEnv: (launchMods, gameFolder) => ({
            ...prefixEnv(),
            "WINEDLLOVERRIDES": "winhttp=n,b", // Required for mods to work
            "STEAM_COMPAT_INSTALL_PATH": gameFolder,
            "STEAM_COMPAT_APP_ID": BS_APP_ID,
            // Run game in steam environment; fixes #585 for unicode song titles
            "SteamEnv": "1",
            // Fix reflections in Monado
            "OXR_NO_TEXTURE_SOURCE_ALPHA": "1",
            ...launchModsEnv(launchMods, gameFolder),
        }),
    };
}

/**
 * A native ARM64 instance (bs-arm64): the installed release's bs-arm64.sh starts the game and sets
 * everything it needs itself (Proton and Steam variables, foveated rendering, Steam's reaper).
 * BSManager only passes on what the user picked. It runs in the foreground, so the game is tracked
 * as usual.
 */
export function bsArm64Runtime(config: ProtonConfig, launchScript: string): GameRuntime {
    return {
        ...protonRuntime(config),
        runCommand: exePath => `bash "${launchScript}" launch "${path.dirname(exePath)}"`
            + ` --prefix "${config.compatDataPath}" --proton "${path.dirname(config.protonPath)}" --`,
        gameEnv: launchModsEnv,
    };
}

export type GameRuntimeFacts = {
    platform: NodeJS.Platform;
    getProtonConfig?: () => Promise<ProtonConfig>;
};

export async function resolveGameRuntime(
    { platform, getProtonConfig }: GameRuntimeFacts,
    bsArm64LaunchScript?: string
): Promise<GameRuntime> {
    if (platform !== "linux") {
        return windowsNativeRuntime;
    }
    if (!getProtonConfig) {
        throw new Error("A Proton configuration is required to run Beat Saber on Linux");
    }
    const config = await getProtonConfig();
    return bsArm64LaunchScript ? bsArm64Runtime(config, bsArm64LaunchScript) : protonRuntime(config);
}
