import cp from "node:child_process";
import log from "electron-log";

export const BSM_LAUNCH_TOKEN_ENV = "BSMANAGER_LAUNCH_TOKEN";

// Only applied if package as flatpak
type FlatpakOptions = {
    // Force to use "flatpak-spawn --host" to run commands outside of the sandbox
    host: boolean;
    // Only copy the keys from options.env from bsmSpawn/bsmExec
    env?: string[];
};

export enum BsmShellLog {
    Command = 0x0000_0001,
    EnvVariables = 0x0000_0002,
};

interface BsmShellOptions<OptionsType> {
    args?: string[] | string;
    options?: OptionsType;
    // Look into BsmShellLog values
    log?: number;
    flatpak?: FlatpakOptions;
};

export type BsmSpawnOptions = BsmShellOptions<cp.SpawnOptions>;
export type BsmExecOptions = BsmShellOptions<cp.ExecOptions>;

function updateCommand(command: string, options: BsmSpawnOptions) {
    if (options?.args) {
        command += typeof(options.args) === "string"
            ? ` ${options.args}`
            : ` ${options.args.join(" ")}`;
    }

    if (process.platform === "linux") {
        // "/bin/sh" does not see flatpak-spawn
        // All distros should support "bash" by default
        options.options.shell = "bash";

        if (options?.flatpak?.host) {
            const envArgs = (options?.flatpak?.env && options?.options?.env)
                && options.flatpak.env
                    .filter(envName => options.options.env[envName])
                    .map(envName =>
                         `--env=${envName}="${options.options.env[envName]}"`
                    )
                    .join(" ");
            command = `flatpak-spawn --host ${envArgs || ""} ${command}`;
        }
    }

    return command;
}

function logValues(shell: "spawn" | "exec", command: string, options?: BsmShellOptions<cp.SpawnOptions | cp.ExecOptions>) {
    const platform = process.platform === "win32" ? "Windows" : "Linux";
    const optionsLog = options?.log || 0;
    const launchToken = options?.options?.env?.[BSM_LAUNCH_TOKEN_ENV];
    const loggedCommand = typeof launchToken === "string" && launchToken.length > 0
        ? command.replaceAll(launchToken, "[REDACTED]")
        : command;

    if ((optionsLog & BsmShellLog.EnvVariables) > 0) {
        const loggedEnvironment = launchToken
            ? { ...options?.options?.env, [BSM_LAUNCH_TOKEN_ENV]: "[REDACTED]" }
            : options?.options?.env;
        log.info(platform, shell, "env", loggedEnvironment);
    }

    if ((optionsLog & BsmShellLog.Command) > 0) {
        log.info(platform, shell, "command\n>", loggedCommand);
    }
}

export function bsmSpawn(command: string, options?: BsmSpawnOptions) {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    logValues("spawn", command, options);

    return cp.spawn(command, options.options);
}

export function bsmExec(command: string, options?: BsmExecOptions): Promise<{
    stdout: string;
    stderr: string;
}> {
    options = options || {};
    options.options = options.options || {};
    command = updateCommand(command, options);

    logValues("exec", command, options);

    return new Promise((resolve, reject) => {
        const execOptions: cp.ExecOptionsWithStringEncoding = {
            ...options.options,
            encoding: "utf8",
        };

        cp.exec(command, execOptions, (error, stdout, stderr) => {
            if (error) { return reject(error); }
            resolve({ stdout, stderr });
        });
    });
}
