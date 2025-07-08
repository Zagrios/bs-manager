import { parseEnvString } from "./env.helpers";

/**
 * Parses the launch options command into parts to be used for bsmSpawn
 *
 * @params command
 * @params options.beatSaberExe - Replaces the %command% string
 * @returns {
 *   env - environment variables
 *   cmdlet - BS.exe or a binary executable like gamemoderun and gamescope
 *   args - Arguments for the cmdlet.
 * }
 */
export function parseLaunchOptions(launchOption: string, options: {
    beatSaberExe: string;
}): {
    env: Record<string, string>;
    cmdlet: string;
    args: string;
} {
    if (!launchOption) {
        return { env: {}, cmdlet: "", args: "" };
    }

    // Get the env variables first
    const {
        env, command
    } = parseEnvString(launchOption);

    // Replace the %command%
    if (options.beatSaberExe) {
        launchOption.replace("%command%", `"${options.beatSaberExe}"`);
    }

    // First word/token is the cmdlet, the rest are the arguments
    const index = command.indexOf(" ");
    if (index === -1) {
        return { env, cmdlet: command, args: "" }
    }

    return {
        env, cmdlet: command.substring(index),
        args: command.substring(index + 1, command.length).trim(),
    }
}

