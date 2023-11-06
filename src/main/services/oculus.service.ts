import regedit from "regedit";
import path from "path";
import { pathExist } from "../helpers/fs.helpers";
import log from "electron-log";
import { lstat } from "fs-extra";

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

        const libsRegData = (await regedit.promisified.list([oculusLibsRegKey]))["HKCU\\SOFTWARE\\Oculus VR, LLC\\Oculus\\Libraries"];

        if (!libsRegData.exists || !libsRegData.keys) {
            return null;
        }

        const defaultLibraryId = libsRegData.values.DefaultLibrary.value as string;

        const libsPath: OculusLibrary[] = (
            await Promise.all(
                libsRegData.keys.map(async key => {
                    const originalPath = (await regedit.promisified.list([`${oculusLibsRegKey}\\${key}`]))[`${oculusLibsRegKey}\\${key}`];
                    if (!originalPath.exists || !libsRegData.values || !originalPath.values.OriginalPath) {
                        return null;
                    }

                    return { id: key, path: originalPath.values.OriginalPath.value, isDefault: defaultLibraryId === key } as OculusLibrary
                }, [])
            )
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
}

export interface OculusLibrary {
    id: string;
    path: string;
    isDefault?: boolean;
}
