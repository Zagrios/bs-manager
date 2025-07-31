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
    const wrappedExe = `"${options.beatSaberExe}"`;
    if (!launchOption) {
        return { env: {}, cmdlet: wrappedExe, args: "" };
    }

    const parsed = parseEnvString(launchOption);
    const { env } = parsed;

    // If launch options only contains env strings
    if (!parsed.command) {
        return { env, cmdlet: wrappedExe, args: "" };
    }

    const command = parsed.command.replace("%command%", wrappedExe);

    // Offset if it starts with a " or '
    let offset = 0;
    if (command.startsWith('"')) {
        offset = command.indexOf('"', 1);
    } else if (command.startsWith("'")) {
        offset = command.indexOf("'", 1);
    }

    // First word/token is the cmdlet, the rest are the arguments
    const index = command.indexOf(" ", offset);
    if (index === -1) {
        return { env, cmdlet: command.trim(), args: "" };
    }

    return {
        env, cmdlet: command.substring(0, index),
        args: command.substring(index + 1, command.length).trim(),
    }
}

