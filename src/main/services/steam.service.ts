import { RegDwordValue } from "regedit-rs"
import path from "path";
import { parse } from "@node-steam/vdf";
import { readFile } from "fs/promises";
import log from "electron-log";
import { app, shell } from "electron";
import { getProcessId, isProcessRunning } from "main/helpers/os.helpers";
import { isElevated } from "query-process";
import { execOnOs } from "../helpers/env.helpers";
import { pathExists, pathExistsSync, readdir, writeFile } from "fs-extra";
import { SteamShortcut, SteamShortcutData } from "../../shared/models/steam/shortcut.model";

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

export class SteamService {
    private static readonly PROCESS_NAME: string = process.platform === "linux" ? "steam-runtime-launcher-service" : "steam.exe";

    private static instance: SteamService;

    private steamPath: string = "";

    private constructor() {}

    public static getInstance() {
        if (!SteamService.instance) {
            SteamService.instance = new SteamService();
        }
        return SteamService.instance;
    }

    public async getActiveUser(): Promise<number> {
        const res = await list("HKCU\\Software\\Valve\\Steam\\ActiveProcess");
        const key = res["HKCU\\Software\\Valve\\Steam\\ActiveProcess"];
        if (!key.exists) {
            throw new Error('Key "HKCU\\Software\\Valve\\Steam\\ActiveProcess" not exist');
        }
        const registryValue = key.values.ActiveUser as RegDwordValue;
        if (!registryValue) {
            throw new Error('Value "ActiveUser" not exist');
        }
        return registryValue.value;
    }

    public async isSteamProcessRunning(): Promise<boolean> {
        return isProcessRunning(SteamService.PROCESS_NAME);
    }

    public async isSteamRunning(): Promise<boolean> {
        const steamProcessRunning = await this.isSteamProcessRunning();
        if (!steamProcessRunning) {
            return false;
        }

        if (process.platform === "linux") {
            return steamProcessRunning;
        }

        try {
            const activeUser = await this.getActiveUser();
            return !!activeUser;
        } catch (err) {
            log.warn("Unable to read Steam active user; falling back to process detection", err);
            return true;
        }
    }

    public async getSteamPid(): Promise<number> {
        return getProcessId(SteamService.PROCESS_NAME);
    }

    /**
     * Check if the Steam process is running as administrator
     * @throws Can throw an error if the Steam process is running as admin
     * @returns true if the Steam process is running as administrator
     */
    public async isElevated(): Promise<boolean> {
        const steamPid = await this.getSteamPid();

        if (!steamPid) {
            return false;
        }

        return isElevated(steamPid);
    }

    public async getSteamPath(): Promise<string> {
        if (this.steamPath) {
            return this.steamPath;
        }

        switch (process.platform) {
            case "linux":
                this.steamPath = path.join(app.getPath("home"), ".steam", "steam");
                return this.steamPath;
            case "win32": {
                const res = await list(["HKLM\\SOFTWARE\\Valve\\Steam", "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam"]);
                const win64 = res["HKLM\\SOFTWARE\\Valve\\Steam"];
                const win32 = res["HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam"];

                if (win64.exists && win64?.values?.InstallPath?.value) {
                    this.steamPath = win64.values.InstallPath.value as string;
                } else if (win32.exists && win32?.values?.InstallPath?.value) {
                    this.steamPath = win32.values.InstallPath.value as string;
                }

                return this.steamPath;
            }
            default:
                return null;
        }
    }

    private async getSteamRootCandidates(): Promise<string[]> {
        const candidates = new Set<string>();
        const steamPath = await this.getSteamPath().catch(() => null);

        if (steamPath) {
            candidates.add(steamPath);
        }

        if (process.platform === "win32") {
            const programFiles = process.env["ProgramFiles"];
            const programFilesX86 = process.env["ProgramFiles(x86)"];
            if (programFiles) {
                candidates.add(path.join(programFiles, "Steam"));
            }
            if (programFilesX86) {
                candidates.add(path.join(programFilesX86, "Steam"));
            }

            for (let code = "A".charCodeAt(0); code <= "Z".charCodeAt(0); code += 1) {
                const drive = `${String.fromCharCode(code)}:\\`;
                candidates.add(path.join(drive, "Steam"));
                candidates.add(path.join(drive, "SteamLibrary"));
            }
        } else if (process.platform === "linux") {
            candidates.add(path.join(app.getPath("home"), ".local", "share", "Steam"));
            candidates.add(path.join(app.getPath("home"), ".steam", "steam"));
        }

        const existing = await Promise.all(Array.from(candidates).map(async candidate => {
            return (await pathExists(path.join(candidate, "steamapps")).catch(() => false)) ? candidate : null;
        }));

        return existing.filter(Boolean);
    }

    private async getGameFolderFallback(gameId: string, gameFolder?: string): Promise<string> {
        if (!gameFolder) {
            return null;
        }

        const roots = await this.getSteamRootCandidates();

        for (const root of roots) {
            const appManifest = path.join(root, "steamapps", `appmanifest_${gameId}.acf`);
            const appFolder = path.join(root, "steamapps", "common", gameFolder);

            if (
                await pathExists(appFolder).catch(() => false)
                || await pathExists(`${appFolder}.bak`).catch(() => false)
                || await pathExists(appManifest).catch(() => false)
            ) {
                log.info("Resolved Steam game folder from fallback", { gameId, gameFolder, appFolder });
                return appFolder;
            }
        }

        log.warn("Unable to resolve Steam game folder", { gameId, gameFolder, roots });
        return null;
    }

    public async getGameFolder(gameId: string, gameFolder?: string): Promise<string> {
        try {
            const steamPath = await this.getSteamPath();

            let libraryFolders: any = path.join(steamPath, "steamapps", "libraryfolders.vdf");

            if (!(await pathExists(libraryFolders))) {
                return this.getGameFolderFallback(gameId, gameFolder);
            }

            libraryFolders = parse(await readFile(libraryFolders, { encoding: "utf-8" }));

            if (!libraryFolders.libraryfolders) {
                return this.getGameFolderFallback(gameId, gameFolder);
            }
            libraryFolders = libraryFolders.libraryfolders;

            for (const libKey of Object.keys(libraryFolders)) {
                if (!libraryFolders?.[libKey]?.apps) {
                    continue;
                }

                if (libraryFolders[libKey].apps[gameId] != null) {
                    const commonFolder = path.join(libraryFolders[libKey].path, "steamapps", "common");
                    return gameFolder ? path.join(commonFolder, gameFolder) : commonFolder;
                }
            }

            if (gameFolder) {
                for (const libKey of Object.keys(libraryFolders)) {
                    if (!libraryFolders?.[libKey]?.path) {
                        continue;
                    }

                    const appFolder = path.join(libraryFolders[libKey].path, "steamapps", "common", gameFolder);
                    if (await pathExists(appFolder) || await pathExists(`${appFolder}.bak`)) {
                        return appFolder;
                    }
                }
            }

            return this.getGameFolderFallback(gameId, gameFolder);
        } catch (e) {
            log.error(e);
            return this.getGameFolderFallback(gameId, gameFolder);
        }
    }

    public async openSteam(): Promise<void> {
        await shell.openExternal("steam://open/games");

        return new Promise((resolve, reject) => {
            // Every 3 seconds check if steam is running
            const interval = setInterval(() => {
                const steamRunning = this.isSteamRunning().catch(() => false);
                steamRunning.then(running => {
                    if (!running) {
                        return;
                    }
                    clearInterval(interval);
                    resolve();
                });
            }, 4000);

            // If steam is not running after 60 seconds, reject
            setTimeout(() => {
                clearInterval(interval);
                reject("Unable to open steam");
            }, 60_000);
        });
    }

    private async getUserDataFolders(): Promise<string[]> {
        const steamPath = await this.getSteamPath();

        if (!steamPath) {
            return [];
        }

        const configPath = path.join(steamPath, "userdata");

        if (!pathExistsSync(configPath)) {
            return [];
        }

        const folders = readdir(configPath, { withFileTypes: true })
            .then(entries => {
                return entries.reduce((acc, entry) => {
                    if (entry.isDirectory() && Number.isInteger(parseInt(entry.name))) {
                        acc.push(path.join(configPath, entry.name));
                    }
                    return acc;
                }, [] as string[]);
            })
            .catch((err): string[] => {
                log.error("Error while reading steam user data folders", err);
                return [];
            });

        return folders;
    }

    private async getShortcutsPath(userId: number): Promise<string> {
        return path.join(await this.getSteamPath(), "userdata", userId.toString(), "config", "shortcuts.vdf");
    }

    private async getShortcuts(userId: number): Promise<SteamShortcut[]> {
        const shortcutsPath = await this.getShortcutsPath(userId);
        const shortcutsString = await readFile(shortcutsPath, { encoding: "utf-8" });

       return SteamShortcut.parseShortcutsRawData(shortcutsString);
    }

    private async writeShortcuts(shortcuts: SteamShortcut[], userId: number): Promise<void> {
        const shortcutsPath = await this.getShortcutsPath(userId);
        const stringData = SteamShortcut.getShortcutsString(shortcuts);
        await writeFile(shortcutsPath, stringData, { encoding: "utf-8" });
    }

    public async createShortcut(shortcutData: SteamShortcutData, userId?: number): Promise<void> {
        const userIds = userId ? [userId] : await (async (): Promise<number[]> => {
            const folders = await this.getUserDataFolders();
            return folders.map(folder => parseInt(path.basename(folder)));
        })();

        for (const userId of userIds) {
            const shortcuts = await this.getShortcuts(userId).catch(e => {
                log.warn("Error while reading shortcuts", e);
                return [] as SteamShortcut[];
            });
            shortcuts.push(new SteamShortcut(shortcutData));

            await this.writeShortcuts(shortcuts, userId);
        }

        log.info("Shortcut created", shortcutData);
    }
}
