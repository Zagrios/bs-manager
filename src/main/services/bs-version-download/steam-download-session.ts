import { app, safeStorage } from "electron";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { SteamDownloadSession } from "main/models/bs-downloader.class";

function sessionPath(username: string): string {
    const key = createHash("sha256").update(username.trim().toLowerCase()).digest("hex");
    return path.join(app.getPath("userData"), "steam-sessions", `${key}.bin`);
}

function encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable() && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text");
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
    const destination = sessionPath(session.username);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporary, safeStorage.encryptString(JSON.stringify(session)), { mode: 0o600, flag: "wx" });
        await rename(temporary, destination);
    } finally {
        await rm(temporary, { force: true });
    }
}
