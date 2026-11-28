import path from "path";
import fs from "fs-extra";
import log from "electron-log";
import { CustomError } from "shared/models/exceptions/custom-error.class";

/**
 * Installs and reverts BSIPA the way its IPA.exe does (BSIPA 4.x, IPA/Program.cs and
 * IPA/Patcher/Backup*.cs in nike4613/BeatSaber-IPA-Reloaded), without running a Windows program:
 * no Wine prefix or Proton on Linux, and nothing that depends on the CPU architecture.
 *
 * It works on the files BSManager extracted from the BSIPA package into the game folder:
 *   IPA/Data/*  -> Beat Saber_Data/      IPA/Libs/*  -> Libs/      IPA/* (files only) -> ./
 * Every file it overwrites or adds is recorded in a backup in IPA/Backups/Beat Saber/<name>/, in
 * IPA.exe's format, so `IPA.exe --revert` can undo a native install and revertBsipa() can undo
 * one made by IPA.exe.
 */

export enum BsipaInstallErrorCode {
    // No Beat Saber_Data/Managed/UnityEngine.CoreModule.dll (IPA.exe: "Game does not seem to be a Unity project")
    NOT_A_UNITY_GAME = "BSIPA_NOT_A_UNITY_GAME",
    // IPA/Data or IPA/Libs is missing: the BSIPA package wasn't extracted
    MISSING_PACKAGE = "BSIPA_MISSING_PACKAGE",
}

const MANIFEST_FILE = "$manifest$.txt";
// IPA.exe runs on Windows (or Wine), so its manifests use "\" and CRLF
const MANIFEST_SEPARATOR = "\\";
const MANIFEST_NEWLINE = "\r\n";
// The version block (VS_FIXEDFILEINFO) every Windows binary's version resource starts with
const VS_FIXEDFILEINFO_SIGNATURE = 0xfeef04bd;

type Paths = {
    root: string;
    ipaRoot: string;
    dataSrc: string;
    libsSrc: string;
    dataDst: string;
    libsDst: string;
    managed: string;
    plugins: string;
    backups: string;
    shortcut: string;
};

function paths(gameFolder: string, executable: string): Paths {
    const root = path.resolve(gameFolder);
    const name = path.basename(executable, path.extname(executable));
    const ipaRoot = path.join(root, "IPA");
    const dataDst = path.join(root, `${name}_Data`);
    return {
        root,
        ipaRoot,
        dataSrc: path.join(ipaRoot, "Data"),
        libsSrc: path.join(ipaRoot, "Libs"),
        dataDst,
        libsDst: path.join(root, "Libs"),
        managed: path.join(dataDst, "Managed"),
        plugins: path.join(root, "Plugins"),
        backups: path.join(ipaRoot, "Backups", name),
        shortcut: path.join(root, `${name} (Patch & Launch).lnk`),
    };
}

/** File version of a Windows binary, e.g. [4, 3, 7, 0]; undefined if it has none. */
export function readFileVersion(binary: Buffer): number[] | undefined {
    const signature = Buffer.alloc(4);
    signature.writeUInt32LE(VS_FIXEDFILEINFO_SIGNATURE);
    // The block is DWORD-aligned; skip matches inside other data
    let i = binary.indexOf(signature);
    while (i >= 0 && i % 4 !== 0) {
        i = binary.indexOf(signature, i + 1);
    }
    if (i < 0 || i + 16 > binary.length) {
        return undefined;
    }
    // dwSignature, dwStrucVersion, dwFileVersionMS, dwFileVersionLS
    const ms = binary.readUInt32LE(i + 8);
    const ls = binary.readUInt32LE(i + 12);
    return [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff];
}

function compareVersions(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); ++i) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) {
            return diff;
        }
    }
    return 0;
}

async function fileVersion(file: string): Promise<number[] | undefined> {
    return (await fs.pathExists(file)) ? readFileVersion(await fs.readFile(file)) : undefined;
}

/** IPA.exe's backup folder name: DateTime.Now.ToString("yyyy-MM-dd_h-mm-ss") (12-hour clock, unpadded hour). */
export function backupName(now: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const hour12 = now.getHours() % 12 || 12;
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${hour12}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

/** A manifest line ("Beat Saber_Data\\Managed\\IPA.Injector.dll") as a path in the game folder; undefined if it leaves it. */
function resolveInRoot(root: string, relative: string): string | undefined {
    const parts = relative.split(/[\\/]/).filter(Boolean);
    if (!parts.length || parts.includes("..") || path.isAbsolute(relative) || /^[a-zA-Z]:/.test(relative)) {
        return undefined;
    }
    return path.join(root, ...parts);
}

/** One backup: the files an install changed, and their previous content (IPA.exe's BackupUnit). */
class BackupUnit {
    private readonly files: string[] = [];

    private constructor(private readonly dir: string) {}

    public static create(backups: string, now: Date): BackupUnit {
        return new BackupUnit(path.join(backups, backupName(now)));
    }

    /** Reads a backup; without a manifest, every file in it counts (as in IPA.exe). */
    public static async read(dir: string): Promise<BackupUnit> {
        const unit = new BackupUnit(dir);
        const manifest = path.join(dir, MANIFEST_FILE);
        if (await fs.pathExists(manifest)) {
            const lines = (await fs.readFile(manifest, "utf8")).split(/\r?\n/).filter(Boolean);
            unit.files.push(...lines);
        } else {
            for (const file of await listFiles(dir)) {
                unit.files.push(path.relative(dir, file).split(path.sep).join(MANIFEST_SEPARATOR));
            }
        }
        return unit;
    }

    /** Records a file before it's overwritten or created, keeping its current content if it has one. */
    public async add(root: string, file: string): Promise<void> {
        const relative = path.relative(root, file);
        if (relative.startsWith("..") || path.isAbsolute(relative)) {
            log.error("Invalid file path for backup", file);
            return;
        }
        const entry = relative.split(path.sep).join(MANIFEST_SEPARATOR);
        if (this.files.includes(entry)) {
            return;
        }
        if (await fs.pathExists(file)) {
            await fs.copy(file, path.join(this.dir, relative), { preserveTimestamps: true });
        } else {
            await fs.ensureDir(path.dirname(path.join(this.dir, relative)));
        }
        await fs.appendFile(path.join(this.dir, MANIFEST_FILE), entry + MANIFEST_NEWLINE, "utf8");
        this.files.push(entry);
    }

    /**
     * Puts back what the install changed: a file with a non-empty backup gets its old content, any
     * other one is deleted (it was added). Then removes the backup and the folders the install
     * left empty.
     */
    public async restore(root: string): Promise<void> {
        const touched: string[] = [];
        for (const entry of this.files) {
            const target = resolveInRoot(root, entry);
            const backup = resolveInRoot(this.dir, entry);
            if (!target || !backup) {
                log.warn("Skipping invalid BSIPA backup entry", entry);
                continue;
            }
            const saved = await fs.stat(backup).catch((): undefined => undefined);
            if (saved?.isFile() && saved.size > 0) {
                await fs.copy(backup, target, { preserveTimestamps: true, overwrite: true });
            } else {
                await fs.remove(target);
            }
            touched.push(target);
        }
        await fs.remove(this.dir);
        await removeEmptyParents(root, touched);
    }
}

async function listFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await listFiles(full)));
        } else if (entry.isFile() && entry.name !== MANIFEST_FILE) {
            files.push(full);
        }
    }
    return files;
}

/**
 * Removes the folders of the given files that are now empty, up to the game folder. IPA.exe removes
 * every empty folder in the game folder instead, which can include the user's own (e.g. an empty
 * CustomLevels); this only touches folders the install put files in.
 */
async function removeEmptyParents(root: string, files: string[]): Promise<void> {
    const dirs = new Set<string>();
    for (const file of files) {
        for (let dir = path.dirname(file); dir.startsWith(root + path.sep); dir = path.dirname(dir)) {
            dirs.add(dir);
        }
    }
    // Deepest first, so a parent is empty once its children are gone
    for (const dir of [...dirs].sort((a, b) => b.length - a.length)) {
        const stat = await fs.lstat(dir).catch((): undefined => undefined);
        if (stat?.isDirectory() && (await fs.readdir(dir)).length === 0) {
            await fs.rmdir(dir).catch(() => {});
        }
    }
}

/** The newest backup (IPA.exe: the one whose name sorts last), if there is one. */
async function latestBackup(backups: string): Promise<BackupUnit | undefined> {
    const entries = await fs.readdir(backups, { withFileTypes: true }).catch((): fs.Dirent[] => []);
    const names = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    const latest = names.at(-1);
    return latest ? BackupUnit.read(path.join(backups, latest)) : undefined;
}

/**
 * Copies a folder's files into another, recording each in the backup first. Without `aggressive`,
 * a file whose target is as new or newer is left alone (IPA.exe's CopyAll).
 */
async function copyAll(source: string, target: string, aggressive: boolean, backup: BackupUnit, root: string, recurse = true): Promise<void> {
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
        const from = path.join(source, entry.name);
        const to = path.join(target, entry.name);
        if (entry.isFile()) {
            if (!aggressive) {
                const [src, dst] = await Promise.all([fs.stat(from), fs.stat(to).catch((): undefined => undefined)]);
                if (dst && dst.mtimeMs >= src.mtimeMs) {
                    continue;
                }
            }
            await backup.add(root, to);
            await fs.copy(from, to, { preserveTimestamps: true, overwrite: true });
        } else if (entry.isDirectory() && recurse) {
            await copyAll(from, to, aggressive, backup, root);
        }
    }
}

export type BsipaInstallOptions = {
    // The game's executable, whose name gives the data folder (IPA.exe takes it as an argument)
    executable?: string;
    // For tests
    now?: Date;
};

/**
 * Installs the BSIPA package extracted in the game folder, like `IPA.exe "Beat Saber.exe" -n`:
 * reverts an earlier install first, copies the files with a backup, and creates Plugins/. Leaves
 * the files alone if a newer BSIPA is already installed.
 */
export async function installBsipa(gameFolder: string, { executable = "Beat Saber.exe", now = new Date() }: BsipaInstallOptions = {}): Promise<void> {
    const p = paths(gameFolder, executable);

    if (!(await fs.pathExists(p.dataDst)) || !(await fs.pathExists(path.join(p.managed, "UnityEngine.CoreModule.dll")))) {
        throw new CustomError(`${p.root} doesn't look like a Unity game`, BsipaInstallErrorCode.NOT_A_UNITY_GAME);
    }
    if (!(await fs.pathExists(p.dataSrc)) || !(await fs.pathExists(p.libsSrc))) {
        throw new CustomError(`The BSIPA package isn't extracted in ${p.ipaRoot}`, BsipaInstallErrorCode.MISSING_PACKAGE);
    }

    // IPA.exe compares the installed injector with its own version; the package's injector has the same one
    const installed = (await fs.pathExists(path.join(p.root, "winhttp.dll"))) ? await fileVersion(path.join(p.managed, "IPA.Injector.dll")) : undefined;
    const packaged = await fileVersion(path.join(p.dataSrc, "Managed", "IPA.Injector.dll"));
    if (installed && packaged && compareVersions(installed, packaged) > 0) {
        log.info(`BSIPA ${installed.join(".")} is newer than the package's ${packaged.join(".")}, not copying files`);
    } else {
        const backup = BackupUnit.create(p.backups, now);
        const previous = await latestBackup(p.backups);
        if (previous) {
            log.info("Restoring the previous BSIPA install");
            await previous.restore(p.root);
        }
        // IPA.exe overwrites everything unless an older backup is still there
        const aggressive = !(await latestBackup(p.backups));

        log.info("Installing BSIPA files");
        await copyAll(p.dataSrc, p.dataDst, aggressive, backup, p.root);
        await copyAll(p.libsSrc, p.libsDst, aggressive, backup, p.root);
        await copyAll(p.ipaRoot, p.root, aggressive, backup, p.root, false);
    }

    await fs.ensureDir(p.plugins);
}

/**
 * Reverts BSIPA like `IPA.exe --revert -n`: restores the newest backup and deletes IPA.exe's
 * shortcut. Also removes BSIPA's own folders once empty (Plugins/, the backup folders), which
 * IPA.exe's sweep of empty folders removes too. Returns false if there was no backup.
 */
export async function revertBsipa(gameFolder: string, { executable = "Beat Saber.exe" }: Pick<BsipaInstallOptions, "executable"> = {}): Promise<boolean> {
    const p = paths(gameFolder, executable);
    const backup = await latestBackup(p.backups);
    if (backup) {
        await backup.restore(p.root);
    }
    await fs.remove(p.shortcut);
    await removeEmptyParents(p.root, [path.join(p.backups, "-"), path.join(p.plugins, "-")]);
    return !!backup;
}
