import { app } from "electron";
import path from "node:path";
import { IS_FLATPAK } from "main/constants";
import { SteamShortcutData } from "shared/models/steam/shortcut.model";

function getBSManagerCommand(launchLink: string) {
    if (process.platform === "linux" && IS_FLATPAK) {
        return {
            executable: process.env.FLATPAK_BINARY || "/usr/bin/flatpak",
            args: ["run", process.env.FLATPAK_ID || "io.bsmanager.bsmanager", launchLink],
            workingDirectory: "/",
        };
    }

    const appImage = process.platform === "linux" ? process.env.APPIMAGE : undefined;
    const executable = appImage || app.getPath("exe");
    const args = process.defaultApp && !appImage
        ? [app.getAppPath(), launchLink]
        : [launchLink];

    return { executable, args, workingDirectory: path.dirname(executable) };
}

function quoteSteamArgument(argument: string): string {
    const escaped = process.platform === "win32"
        ? argument.replaceAll(/\\+|"/g, (match, offset: number) => {
            if (match === '"') return String.raw`\"`;
            const next = offset + match.length;
            return next === argument.length || argument[next] === '"' ? match.repeat(2) : match;
        })
        : argument.replaceAll(/[\\"$`]/g, String.raw`\$&`);
    return `"${escaped}"`;
}

function escapeDesktopValue(value: string): string {
    return value.replaceAll("\\", String.raw`\\`)
        .replaceAll("\n", String.raw`\n`)
        .replaceAll("\r", String.raw`\r`)
        .replaceAll("\t", String.raw`\t`);
}

function quoteDesktopArgument(argument: string): string {
    // Desktop entries decode string escapes before Exec quoting and field codes.
    // https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html
    return `"${argument.replaceAll(/[\\"$`]/g, String.raw`\$&`).replaceAll("%", "%%")}"`;
}

export function buildSteamShortcutData(name: string, icon: string, launchLink: string): SteamShortcutData {
    const command = getBSManagerCommand(launchLink);
    return {
        AppName: name,
        Exe: command.executable,
        StartDir: command.workingDirectory,
        icon,
        OpenVR: "\x01",
        LaunchOptions: command.args.map(quoteSteamArgument).join(" "),
    };
}

export function buildLinuxDesktopEntry(name: string, icon: string, launchLink: string): string {
    const command = getBSManagerCommand(launchLink);
    // GIO looks up the executable before expanding %% escapes. Pass such paths
    // as an argument to env so they are expanded before the executable is opened.
    const executable = command.executable.includes("%")
        ? ["/usr/bin/env", command.executable]
        : [command.executable];
    const exec = [...executable, ...command.args].map(quoteDesktopArgument).join(" ");
    return [
        "[Desktop Entry]",
        "Type=Application",
        `Name=${escapeDesktopValue(name)}`,
        `Icon=${escapeDesktopValue(icon)}`,
        `Path=${escapeDesktopValue(command.workingDirectory)}`,
        `Exec=${escapeDesktopValue(exec)}`,
    ].join("\n");
}
