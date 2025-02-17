import path from "path";
import { pathExist, resolveGUIDPath } from "../helpers/fs.helpers";
import log from "electron-log";
import { lstat } from "fs-extra";
import { tryit } from "../../shared/helpers/error.helpers";
import { app, shell } from "electron";
import { isProcessRunning } from "../helpers/os.helpers";
import { sToMs } from "../../shared/helpers/time.helpers";
import { execOnOs } from "../helpers/env.helpers";
import { UtilsService } from "./utils.service";
import { exec } from "child_process";

const { list } = (execOnOs({ win32: () => require("regedit-rs") }, true) ?? {}) as typeof import("regedit-rs");

export class OculusService {
    private static instance: OculusService;

    public static getInstance(): OculusService {
        if (!OculusService.instance) {
            OculusService.instance = new OculusService();
        }
        return OculusService.instance;
    }


    private readonly utils: UtilsService;

    private oculusLibraries: OculusLibrary[];

    private constructor() {
        this.utils = UtilsService.getInstance();
    }

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

    public async isSideLoadedAppsEnabled(): Promise<boolean> {
        if(process.platform !== "win32"){
            log.info("Cannot check sideloaded apps on non-windows platforms");
            throw new Error("Cannot check sideloaded apps on non-windows platforms");
        }

        const regPath = "HKLM\\SOFTWARE\\Wow6432Node\\Oculus VR, LLC\\Oculus";
        const res = await list(regPath).then(res => res[regPath]);

        if(!res.exists){
            log.info("Registry key not found", regPath);
            return false;
        }

        const value = res.values?.AllowDevSideloaded;

        if(!value){
            log.info("Registry value not found", "AllowDevSideloaded");
            return false;
        }

        return value.value === 1;
    }

    public async enableSideloadedApps(): Promise<void> {
        if(process.platform !== "win32"){
            log.info("Cannot enable sideloaded apps on non-windows platforms");
            return;
        }

        const enabled = await this.isSideLoadedAppsEnabled();

        if(enabled){
            log.info("Sideloaded apps already enabled");
            return;
        }

        const exePath = path.join(this.utils.getAssetsScriptsPath(), "oculus-allow-dev-sideloaded.exe");

        return new Promise((resolve, reject) => {
            log.info("Enabling sideloaded apps");
            const process = exec(`"${exePath}" --log-path "${path.join(app.getPath("logs"), "oculus-allow-dev-sideloaded.log")}"`);
            process.on("exit", code => {
                if(code === 0){
                    resolve();
                } else {
                    reject(new Error(`Failed to enable sideloaded apps, exit code: ${code}`));
                }
            });

            process.on("error", err => {
                log.error("Error while enabling sideloaded apps", err);
                reject(err);
            });

            process.stdout.on("data", data => {
                log.info(data.toString?.() ?? data);
            });
        })
    }
}

export interface OculusLibrary {
    id: string;
    path: string;
    isDefault?: boolean;
}
