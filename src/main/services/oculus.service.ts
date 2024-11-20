import path from "path";
import { pathExist, resolveGUIDPath } from "../helpers/fs.helpers";
import log from "electron-log";
import { lstat } from "fs-extra";
import { tryit } from "../../shared/helpers/error.helpers";
import { shell } from "electron";
import { isProcessRunning } from "../helpers/os.helpers";
import { sToMs } from "../../shared/helpers/time.helpers";
import { execOnOs } from "../helpers/env.helpers";

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

export class OculusService {
    private static instance: OculusService;

    private oculusLibraries: OculusLibrary[];

    public static getInstance(): OculusService {
        if (!OculusService.instance) {
            OculusService.instance = new OculusService();
        }
        return OculusService.instance;
    }

    private constructor() {}

    public async getOculusLibs(): Promise<OculusLibrary[]> {
        if (process.platform !== "win32") {
            log.info("Oculus library auto-detection not supported on non-windows platforms");
            return null;
        }

        if (this.oculusLibraries) {
            return this.oculusLibraries;
        }

        const oculusLibsRegKey = "HKCU\\SOFTWARE\\Oculus VR, LLC\\Oculus\\Libraries";
        const libsRegData = await list(oculusLibsRegKey).then(data => data[oculusLibsRegKey]);

        if (!libsRegData.keys?.length) {
            log.info("Registry key \"HKCU\\SOFTWARE\\Oculus VR, LLC\\Oculus\\Libraries\" not found");
            return null;
        }

        const defaultLibraryId = libsRegData.values.DefaultLibrary.value as string;

        const libsPath: OculusLibrary[] = (
            await Promise.all(libsRegData.keys.map(async key => {
                const originalPath = await list([`${oculusLibsRegKey}\\${key}`]).then(res => res[`${oculusLibsRegKey}\\${key}`]);

                if (originalPath.values?.OriginalPath) {
                    return { id: key, path: originalPath.values.OriginalPath.value, isDefault: defaultLibraryId === key } as OculusLibrary;
                }

                if(originalPath.values?.Path) {
                    const { result } = tryit(() => resolveGUIDPath(originalPath.values.Path.value as string));
                    return result ? { id: key, path: result, isDefault: defaultLibraryId === key } as OculusLibrary : null;
                }

                return null;
            }, []))
        ).filter(Boolean);

        this.oculusLibraries = libsPath;

        return libsPath;
    }

    public async getGameFolder(gameFolder: string): Promise<string> {
        const libsFolders = await this.getOculusLibs();

        if (!libsFolders) {
            return null;
        }

        const rootLibDir = "Software";

        for (const { path: libPath } of libsFolders) {
            const gameFullPath = path.join(libPath, rootLibDir, gameFolder);
            if (await pathExist(gameFullPath)) {
                return (await lstat(gameFullPath)).isSymbolicLink() ? null : gameFullPath;
            }
        }

        return null;
    }

    /**
     * Return the first game folder found in the list
     * @param {string[]} gameFolders
     */
    public async tryGetGameFolder(gameFolders: string[]): Promise<string> {
        for(const gameFolder of gameFolders){
            const fullPath = await this.getGameFolder(gameFolder);
            if(fullPath){ return fullPath; }
        }

        return null;
    }

    public oculusRunning(): Promise<boolean> {
        return isProcessRunning("OculusClient");
    }

    public async startOculus(): Promise<void>{
        if(await this.oculusRunning()){ return; }

        await shell.openPath("oculus://view/homepage");

        return new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                if(!(await this.oculusRunning())){ return; }
                clearInterval(interval);
                resolve();
            }, sToMs(3));

            setTimeout(() => {
                clearInterval(interval);
                reject(new Error("Unable to open Oculus"));
            }, sToMs(30));
        });
    }
}

export interface OculusLibrary {
    id: string;
    path: string;
    isDefault?: boolean;
}
