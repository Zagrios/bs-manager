import { app, safeStorage } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { SteamDownloadSession } from "main/models/bs-downloader.class";

export interface SteamSessionStorage {
    loadUsername(): Promise<string | undefined>;
    saveUsername(username: string): Promise<void>;
    loadSession(username?: string): Promise<SteamDownloadSession | undefined>;
    saveSession(session: SteamDownloadSession): Promise<void>;
    clear(): Promise<void>;
}

function sessionsDirectory(): string {
    return path.join(app.getPath("userData"), "steam-sessions");
}

function sessionPath(username: string): string {
    const key = createHash("sha256").update(username.trim().toLowerCase()).digest("hex");
    return path.join(sessionsDirectory(), `${key}.bin`);
}

function usernamePath(): string {
    return path.join(sessionsDirectory(), "username.json");
}

function encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
}

async function writeAtomically(destination: string, data: string | Buffer): Promise<void> {
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, data, { mode: 0o600, flag: "wx" });
        await rename(temporary, destination);
    } finally {
        await rm(temporary, { force: true });
    }
}

export async function loadSteamDownloadSession(username?: string): Promise<SteamDownloadSession | undefined> {
    if (!username || !encryptionAvailable()) { return undefined; }
    try {
        const saved: SteamDownloadSession = JSON.parse(safeStorage.decryptString(await readFile(sessionPath(username))));
        if (typeof saved.username !== "string" || typeof saved.refreshToken !== "string" || saved.username.toLowerCase() !== username.trim().toLowerCase()) { return undefined; }
        return saved;
    } catch { return undefined; }
}

export async function saveSteamDownloadSession(session: SteamDownloadSession): Promise<void> {
    if (!encryptionAvailable()) { throw new Error("Secure credential storage unavailable"); }
    await writeAtomically(sessionPath(session.username), safeStorage.encryptString(JSON.stringify(session)));
}

export async function loadSteamUsername(): Promise<string | undefined> {
    try {
        const { username } = JSON.parse(await readFile(usernamePath(), "utf8"));
        return typeof username === "string" && username ? username : undefined;
    } catch { return undefined; }
}

export async function saveSteamUsername(username: string): Promise<void> {
    await writeAtomically(usernamePath(), JSON.stringify({ username }));
}

export async function clearSteamDownloadSessions(): Promise<void> {
    await rm(sessionsDirectory(), { recursive: true, force: true });
}

export const steamSessionStorage: SteamSessionStorage = {
    loadUsername: loadSteamUsername,
    saveUsername: saveSteamUsername,
    loadSession: loadSteamDownloadSession,
    saveSession: saveSteamDownloadSession,
    clear: clearSteamDownloadSessions,
};
