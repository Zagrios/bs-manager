import path from "path";
import log from "electron-log";
import { BS_APP_ID, BS_EXECUTABLE } from "main/constants";
import { parseLaunchOptions } from "main/helpers/launchOptions.helper";
import { BSM_LAUNCH_TOKEN_ENV } from "main/helpers/os.helpers";
import { LaunchOption } from "shared/models/bs-launch";
import { LaunchMods } from "shared/models/bs-launch/launch-option.interface";
import { GameRuntime, GameRuntimeFacts, resolveGameRuntime, windowsNativeRuntime } from "./game-runtime";

export type LaunchContext = GameRuntimeFacts & {
    flatpak: boolean;
    baseEnv: NodeJS.ProcessEnv;
};

export type LaunchRequest = {
    store: "steam" | "oculus";
    launchOptions: LaunchOption;
    gameFolder: string;
};

export type LaunchPlan = {
    cmdlet: string;
    args: string[];
    env: Record<string, string>;
    hostEnvKeys?: string[];
    elevated?: { exePath: string; args: string[] };
};

export type PrefixCommandPlan = {
    command: string;
    env: Record<string, string>;
    hostEnvKeys?: string[];
};

export function buildBsLaunchArgs(launchOptions: LaunchOption): string[] {
    const launchArgs = [];

    if(!launchOptions.version.steam && !launchOptions.version.oculus){
        launchArgs.push("--no-yeet")
    }
    if(launchOptions.launchMods?.includes(LaunchMods.OCULUS)) {
        launchArgs.push("-vrmode");
        launchArgs.push("oculus");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.FPFC)) {
        launchArgs.push("fpfc");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.DEBUG)) {
        launchArgs.push("--verbose");
    }
    if(launchOptions.launchMods?.includes(LaunchMods.EDITOR)) {
        launchArgs.push("editor");
    }

    return launchArgs;
}

function logUserEnv(userEnv: Record<string, string>, env: Record<string, string>): void {
    for (const [ key, value ] of Object.entries(userEnv)) {
        log.info(
            key in env ? "Overriding" : "Injecting",
            `${key}="${value}"`,
            "to the env launch command"
        );
    }
}

const INHERITED_HOST_ENV_KEYS = [
    "VR_OVERRIDE",
    "XR_RUNTIME_JSON",
    "WINEDLLOVERRIDES",
    "OXR_PARALLEL_VIEWS",
    "PROTON_LOG",
    "PROTON_LOG_DIR",
];

function hostEnvKeys(context: LaunchContext, planEnv: Record<string, string>): string[] | undefined {
    if (!context.flatpak) {
        return undefined;
    }
    const inherited = INHERITED_HOST_ENV_KEYS.filter(key => !(key in planEnv) && context.baseEnv[key]);
    return [...Object.keys(planEnv), ...inherited];
}

export async function planLaunch(request: LaunchRequest, context: LaunchContext): Promise<LaunchPlan> {
    const { store, launchOptions, gameFolder } = request;
    const launchMods = launchOptions.launchMods ?? [];
    const exePath = path.join(gameFolder, BS_EXECUTABLE);

    const runtime: GameRuntime = store === "oculus"
        ? windowsNativeRuntime
        : await resolveGameRuntime(context);

    const { env: userEnv, cmdlet, args: userArgs } = parseLaunchOptions(launchOptions.command, {
        commandReplacement: runtime.runCommand(exePath),
    });

    const planEnv: Record<string, string> = {
        ...(store === "steam" ? {
            "SteamAppId": BS_APP_ID,
            "SteamOverlayGameId": BS_APP_ID,
            "SteamGameId": BS_APP_ID,
        } : {}),
        ...runtime.gameEnv(launchMods, gameFolder),
    };
    logUserEnv(userEnv, { ...context.baseEnv, ...planEnv });
    Object.assign(planEnv, userEnv);

    const gameArgs = buildBsLaunchArgs(launchOptions);

    if (store === "steam" && launchMods.includes(LaunchMods.FPFC) && !launchMods.includes(LaunchMods.OCULUS)) {
        planEnv.VR_OVERRIDE = exePath;
        planEnv.XR_RUNTIME_JSON = path.join(exePath, "disabled-openxr.json");
        gameArgs.push("-vrmode", "None");
    }

    const elevate = store === "steam" && !!launchOptions.admin && runtime.supportsElevation;

    return {
        cmdlet,
        args: userArgs ? [userArgs, ...gameArgs] : gameArgs,
        env: { ...context.baseEnv, ...planEnv },
        hostEnvKeys: hostEnvKeys(context, planEnv),
        elevated: elevate ? { exePath, args: gameArgs } : undefined,
    };
}

export async function planPrefixCommand(
    exePath: string,
    args: string[],
    context: LaunchContext
): Promise<PrefixCommandPlan> {
    const runtime = await resolveGameRuntime(context);
    const planEnv = runtime.prefixEnv();

    return {
        command: [runtime.prefixCommand(exePath), ...args].join(" "),
        env: { ...context.baseEnv, ...planEnv },
        hostEnvKeys: hostEnvKeys(context, planEnv),
    };
}

export function withLaunchToken(plan: LaunchPlan, launchToken?: string): LaunchPlan {
    if (!launchToken) {
        return plan;
    }
    return {
        ...plan,
        env: { ...plan.env, [BSM_LAUNCH_TOKEN_ENV]: launchToken },
        hostEnvKeys: plan.hostEnvKeys && [...plan.hostEnvKeys, BSM_LAUNCH_TOKEN_ENV],
    };
}
