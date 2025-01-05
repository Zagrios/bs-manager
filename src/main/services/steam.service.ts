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
import { SteamShortcut, SteamShortcutKey } from "../../shared/models/steam/shortcut.model";

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

    public async isSteamRunning(): Promise<boolean> {
        const steamProcessRunning = await isProcessRunning(SteamService.PROCESS_NAME);
        if (process.platform === "linux") {
            return steamProcessRunning;
        }
        const activeUser = await this.getActiveUser().catch(err => log.error(err));
        return steamProcessRunning && !!activeUser;
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

    public async getGameFolder(gameId: string, gameFolder?: string): Promise<string> {
        try {
            const steamPath = await this.getSteamPath();

            let libraryFolders: any = path.join(steamPath, "steamapps", "libraryfolders.vdf");

            if (!(await pathExists(libraryFolders))) {
                return null;
            }

            libraryFolders = parse(await readFile(libraryFolders, { encoding: "utf-8" }));

            if (!libraryFolders.libraryfolders) {
                return null;
            }
            libraryFolders = libraryFolders.libraryfolders;

            for (const libKey in Object.keys(libraryFolders)) {
                if (!libraryFolders?.[libKey]?.apps) {
                    continue;
                }

                if (libraryFolders[libKey].apps[gameId] != null) {
                    return path.join(libraryFolders[libKey].path, "steamapps", "common", gameFolder);
                }
            }

            return null;
        } catch (e) {
            log.error(e);
            return null;
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
                }, []);
            })
            .catch(err => {
                log.error("Error while reading steam user data folders", err);
                return [];
            });

        return folders;
    }

    private async getShortcutsPath(userId: number): Promise<string> {
        return path.join(await this.getSteamPath(), "userdata", userId.toString(), "config", "shortcuts.vdf");
    }

    private async readShortcutsFile(shortcutsPath: string): Promise<SteamShortcut[]> {
        // Code taken from: https://developer.valvesoftware.com/wiki/Steam_Library_Shortcuts#Reading_the_shortcuts.vdf

        const rawData: string = await readFile(shortcutsPath, "utf-8");
        const startIndex = rawData.indexOf("\u0000shortcuts\u0000");
        if (startIndex < 0) {
            console.error("Could not find shortcuts in shortcuts.vdf");
            return [];
        }
        const start = startIndex + "\u0000shortcuts\u0000".length;
        const end = rawData.lastIndexOf("\u0008\u0008");
        if (end < 0 || end <= start) {
            console.error("Could not find end of shortcuts in shortcuts.vdf");
            return [];
        }

        const shortcutsString = rawData.substring(start, end - start);

        const result: SteamShortcut[] = [];
        let currentShortcut: SteamShortcut | null = null;
        let word = "";
        let key = "";
        let readingTags = false;
        let tagId = -1;

        const shortcutKeysRegex = new RegExp(`(\u0001|\u0002)(${Object.values(SteamShortcutKey).join("|")})`, "i");

        for (const c of shortcutsString) {

            if (c === "\u0000") {
                if (word.endsWith(`\u0001${SteamShortcutKey.AppName}`)) {
                    if (currentShortcut) {
                        result.push(currentShortcut);
                    }
                    currentShortcut = {
                        AppName: "",
                        Exe: "",
                        StartDir: "",
                        icon: "",
                        LaunchOptions: "",
                        IsHidden: null,
                        tags: [],
                    };
                    key = `\u0001${SteamShortcutKey.AppName}`;
                } else if (shortcutKeysRegex.test(word)) {
                    key = word;
                } else if (word === SteamShortcutKey.tags) {
                    readingTags = true;
                } else if (key !== "") {
                    const currentKey = shortcutKeysRegex.exec(key).pop().replaceAll("\u0001", "").replaceAll("\u0002", "") as SteamShortcutKey;
                    if (currentShortcut && currentKey && currentKey !== SteamShortcutKey.tags) {
                        currentShortcut[currentKey] = (word as string & string[]);
                    }
                    key = "";
                } else if (readingTags) {
                    if (word.startsWith("\u0001")) {
                        tagId = parseInt(word.substring(1), 10);
                    } else if (tagId >= 0 && currentShortcut) {
                        currentShortcut.tags.push(word);
                        tagId = -1;
                    } else {
                        readingTags = false;
                    }
                }
                word = "";
            } else {
                word += c;
            }
        }

        if (currentShortcut) {
            result.push(currentShortcut);
        }

        return result;
    }

    private async getShortcuts(userId: number): Promise<SteamShortcut[]> {
        const shortcutsPath = await this.getShortcutsPath(userId);
        return this.readShortcutsFile(shortcutsPath);
    }

    private buildShortcutTagsString(tags: string[]): string {
        let tagString = "\u0000tags\u0000";
        for (let i = 0; i < tags.length; i++) {
            tagString += `\u0001${i}\u0000${tags[i]}\u0000`;
        }
        tagString += "\u0008";
        return tagString;
    }

    private buildShortcutString(shortcut: SteamShortcut): string {
        const getSeparator = (key: SteamShortcutKey): string => {
            return key === SteamShortcutKey.IsHidden || key === SteamShortcutKey.appid ? "\u0002" : "\u0001";
        };

        const getQuote = (key: SteamShortcutKey): string => {
            return key === SteamShortcutKey.Exe || key === SteamShortcutKey.StartDir || key === SteamShortcutKey.icon ? "\"" : "";
        }

        let shortcutString = "";
        for (const key of Object.keys(shortcut)) {
            console.log("KEY", key);
            if(key === SteamShortcutKey.tags) {
                continue;
            }

            const value = shortcut[key as SteamShortcutKey];
            shortcutString += `${getSeparator(key as SteamShortcutKey)}${key}\u0000\"${value}\"\u0000`;
        }

        shortcutString += `\u0000\u0000${this.buildShortcutTagsString(shortcut.tags)}`;
        return shortcutString;
    }

    private async writeShortcuts(shortcuts: SteamShortcut[], userId: number): Promise<void> {
        let shortcutsString = "\u0000shortcuts\u0000";
        for (let i = 0; i < shortcuts.length; i++) {
            shortcutsString += `\u0000${i}\u0000`;
            shortcutsString += this.buildShortcutString(shortcuts[i]);
            shortcutsString += "\u0008";
        }
        shortcutsString += "\u0008\u0008";

        const shortcutsPath = await this.getShortcutsPath(userId);
        await writeFile(shortcutsPath, shortcutsString, { encoding: "utf-8" });

    }

    public async createShortcut(shortcutData: SteamShortcut, userId?: number): Promise<void> {
        const userIds = userId ? [userId] : await (async (): Promise<number[]> => {
            const folders = await this.getUserDataFolders();
            return folders.map(folder => parseInt(path.basename(folder)));
        })();

        for (const userId of userIds) {
            const shortcuts = await this.getShortcuts(userId).catch(e => {
                log.warn("Error while reading shortcuts", e);
                return [];
            });
            shortcuts.push(shortcutData);
            await this.writeShortcuts(shortcuts, userId);
        }

        log.info("Shortcut created", shortcutData);
    }
}
