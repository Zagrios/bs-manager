import { parseEnvString } from "./env.helpers";

const COMMAND_KEYWORD = "%command%";

/**
 * Parses the launch options command into parts to be used for bsmSpawn
 *
 * @params command
 * @params options.commandReplacement - Replaces the %command% string
 * @params options.linux - If the application is running under linux. Can be toggled in testing to check if the logic works.
 * @returns {
 *   env - environment variables
 *   cmdlet - BS.exe or a binary executable like gamemoderun and gamescope
 *   args - Arguments for the cmdlet.
 * }
 */
export function parseLaunchOptions(launchOption: string, options: {
    commandReplacement: string;
}): {
    env: Record<string, string>;
    cmdlet: string;
    args: string;
} {
    if (!launchOption) {
        return { env: {}, cmdlet: options.commandReplacement, args: "" };
    }

    const parsed = parseEnvString(launchOption);
    const { env } = parsed;

    // If launch options only contains env strings
    if (!parsed.command) {
        return { env, cmdlet: options.commandReplacement, args: "" };
    }

    const command = parsed.command.indexOf(COMMAND_KEYWORD) === -1
        ? `${options.commandReplacement} ${parsed.command}`
        : parsed.command.replace(COMMAND_KEYWORD, options.commandReplacement);

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
        args: command.substring(index + 1).trim(),
    }
}

