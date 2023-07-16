import path from "path";
import { LaunchOption, BSLaunchEvent, BSLaunchEventData, BSLaunchWarning, BSLaunchErrorData, BSLaunchError } from "../../shared/models/bs-launch";
import { UtilsService } from "./utils.service";
import { BS_EXECUTABLE, BS_APP_ID, STEAMVR_APP_ID, IMAGE_CACHE_PATH } from "../constants";
import { ChildProcessWithoutNullStreams, SpawnOptionsWithoutStdio, spawn } from "child_process";
import { SteamService } from "./steam.service";
import { BSLocalVersionService } from "./bs-local-version.service";
import { OculusService } from "./oculus.service";
import { pathExist } from "../helpers/fs.helpers";
import { rename } from "fs/promises";
import log from "electron-log";
import { Observable, lastValueFrom, of, timer } from "rxjs";
import { BsmProtocolService } from "./bsm-protocol.service";
import { app, shell} from "electron";
import { Resvg } from "@resvg/resvg-js";
import Color from "color";
import { ensureDir, writeFile } from "fs-extra";
import toIco from "to-ico";
import { objectFromEntries } from "../../shared/helpers/object.helpers";
import { WindowManagerService } from "./window-manager.service";
import { IpcService } from "./ipc.service";
import { BSVersionLibService } from "./bs-version-lib.service";
import { execOnOs } from "../helpers/env.helpers";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly utilsService: UtilsService;
    private readonly steamService: SteamService;
    private readonly localVersionService: BSLocalVersionService;
    private readonly bsmProtocolService: BsmProtocolService;
    private readonly windows: WindowManagerService;
    private readonly ipc: IpcService;
    private readonly remoteVersion: BSVersionLibService;

    public static getInstance(): BSLauncherService {
        if (!BSLauncherService.instance) {
            BSLauncherService.instance = new BSLauncherService();
        }
        return BSLauncherService.instance;
    }

    private constructor() {
        this.utilsService = UtilsService.getInstance();
        this.steamService = SteamService.getInstance();
        this.localVersionService = BSLocalVersionService.getInstance();
        this.bsmProtocolService = BsmProtocolService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.ipc = IpcService.getInstance();
        this.remoteVersion = BSVersionLibService.getInstance();

        this.bsmProtocolService.on("launch", link => {
            log.info("Launch from bsm protocol", link.toString());
            const shortcutParams = objectFromEntries(link.searchParams.entries()) as ShortcutParams;
            this.openShortcutLaunchWindow(shortcutParams);
        });
    }

    private getSteamVRPath(): Promise<string> {
        return this.steamService.getGameFolder(STEAMVR_APP_ID, "SteamVR");
    }

    private async backupSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        if (!(await pathExist(steamVrFolder))) {
            return;
        }
        return rename(steamVrFolder, `${steamVrFolder}.bak`).catch(log.error);
    }

    public async restoreSteamVR(): Promise<void> {
        const steamVrFolder = await this.getSteamVRPath();
        const steamVrBackup = `${steamVrFolder}.bak`;
        if (!(await pathExist(steamVrBackup))) {
            return;
        }
        return rename(steamVrBackup, steamVrFolder).catch(log.error);
    }

    public async isBsRunning(): Promise<boolean> {
        return this.utilsService.taskRunning(BS_EXECUTABLE);
    }

    private buildBsLaunchArgs(launchOptions: LaunchOption): string[]{
        const launchArgs = [];

        if (launchOptions.oculus) {
            launchArgs.push("-vrmode");
            launchArgs.push("oculus");
        }
        if (launchOptions.desktop) {
            launchArgs.push("fpfc");
        }
        if (launchOptions.debug) {
            launchArgs.push("--verbose");
        }
        if (launchOptions.additionalArgs) {
            launchArgs.push(...launchOptions.additionalArgs);
        }

        return Array.from(new Set(launchArgs).values());
    }

    private launchBSProcess(bsExePath: string, args: string[], debug = false): ChildProcessWithoutNullStreams{

        const spawnOptions: SpawnOptionsWithoutStdio = { detached: true, cwd: path.dirname(bsExePath), env: {...process.env, "SteamAppId": BS_APP_ID} };

        if(debug){
            spawnOptions.windowsVerbatimArguments = true;
        }

        return spawn(bsExePath, args, spawnOptions);

    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        return new Observable<BSLaunchEventData>(obs => {(async () => {

            if(launchOptions.skipAlreadyRunning !== true && await this.isBsRunning()){
                return obs.error({type: BSLaunchError.BS_ALREADY_RUNNING} as BSLaunchErrorData);
            }

            const bsFolderPath = await this.localVersionService.getInstalledVersionPath(launchOptions.version);
            const exePath = path.join(bsFolderPath, BS_EXECUTABLE);

            if(!(await pathExist(exePath))){
                return obs.error({type: BSLaunchError.BS_NOT_FOUND} as BSLaunchErrorData);
            }

            // Open Steam if not running
            if(!launchOptions.version.oculus && !(await this.steamService.steamRunning())){
                obs.next({type: BSLaunchEvent.STEAM_LAUNCHING});

                await this.steamService.openSteam().then(() => {
                    obs.next({type: BSLaunchEvent.STEAM_LAUNCHED});
                }).catch(e => {
                    log.error(e);
                    obs.next({type: BSLaunchWarning.UNABLE_TO_LAUNCH_STEAM});
                });
            }

            // Backup SteamVR when desktop mode is enabled
            if(!launchOptions.version.oculus && launchOptions.desktop){
                await this.backupSteamVR().catch(() => {
                    return this.restoreSteamVR();
                });
                await lastValueFrom(timer(2_000));
            } else if(!launchOptions.version.oculus){
                await this.restoreSteamVR();
            }

            const launchArgs = this.buildBsLaunchArgs(launchOptions);

            obs.next({type: BSLaunchEvent.BS_LAUNCHING});

            await new Promise<number>((resolve, reject) => {
                const bsProcess = this.launchBSProcess(exePath, launchArgs, launchOptions.debug);

                bsProcess.on("error", reject);
                bsProcess.on("exit", resolve);

                setTimeout(() => {
                    bsProcess.removeAllListeners("error");
                    bsProcess.removeAllListeners("exit");
                    resolve(-1);
                }, 4000);

            }).then(exitCode => {
                log.info("BS process exit code", exitCode);
            }).catch(err => {
                log.error(err);
                obs.error({type: BSLaunchError.BS_EXIT_ERROR, data: err} as BSLaunchErrorData);
            });

        })().then(() => {
            obs.complete();
        }).catch(err => {
            obs.error({type: BSLaunchError.UNKNOWN_ERROR, data: err} as BSLaunchErrorData);
        })});
    }

    private shortcutParamsToLaunchOption(params: ShortcutParams): LaunchOption{
        const res: LaunchOption = {
            version: {
                BSVersion: params.version,
                name: params.versionName,
                steam: params.versionSteam === "true",
                oculus: params.versionOculus === "true",
                ino: +params.versionIno
            },
            oculus: params.oculusMode === "true",
            desktop: params.desktopMode === "true",
            debug: params.debug === "true",
            additionalArgs: params.additionalArgs
        };

        return res;
    }

    private launchOptionToShortcutParams(launchOptions: LaunchOption): ShortcutParams{
        const res: ShortcutParams = { version: launchOptions.version.BSVersion };

        if(launchOptions.version.name){ res.versionName = launchOptions.version.name; }
        if(launchOptions.version.steam){ res.versionSteam = `${launchOptions.version.steam}`; }
        if(launchOptions.version.oculus){ res.versionOculus = `${launchOptions.version.oculus}`; }
        if(launchOptions.version.ino){ res.versionIno = `${launchOptions.version.ino}`; }

        if(launchOptions.oculus){ res.oculusMode = "true"; }
        if(launchOptions.desktop){ res.desktopMode = "true"; }
        if(launchOptions.debug){ res.debug = "true"; }
        if(launchOptions.additionalArgs){ res.additionalArgs = launchOptions.additionalArgs; }

        return res;
    }

    private createShortcutPngBuffer(color: Color): Buffer{
        
        const svgIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 406.4 406.4" height="406.4" width="406.4">
                <rect rx="69.453" height="406.4" width="406.4" fill="${color.hex()}"/>
                <path d="M65.467 60.6H336.4v33.867L200.933 162.2 65.467 94.467z" fill="#fff"/>
            </svg>
        `;

        return new Resvg(svgIcon, {
            fitTo: { mode: "width", value: 256 }
        }).render().asPng();

    }

    /**
     * Create .png file for the shortcut with the given color
     * @param {Color} color 
     * @returns {Promise<string>} Path of the icon 
     */
    private async createShortcutPng(color: Color): Promise<string>{
        const pngBuffer = this.createShortcutPngBuffer(color);

        await ensureDir(IMAGE_CACHE_PATH);

        const iconPath = path.join(IMAGE_CACHE_PATH, `launch_shortcut_${color.hex()}.png`);

        await writeFile(iconPath, pngBuffer);

        return iconPath;
    }

    /**
     * Create .ico file for the shortcut with the given color
     * @param {Color} color
     * @returns {Promise<string>} Path of the icon
     */
    private async createShortcutIco(color: Color): Promise<string>{
        const pngBuffer = this.createShortcutPngBuffer(color);
        const icoBuffer = await toIco([pngBuffer]);

        await ensureDir(IMAGE_CACHE_PATH);

        const iconPath = path.join(IMAGE_CACHE_PATH, `launch_shortcut_${color.hex()}.ico`);

        await writeFile(iconPath, icoBuffer);

        return iconPath;
    }

    public async createLaunchShortcut(launchOptions: LaunchOption): Promise<boolean>{
        const shortcutParams = this.launchOptionToShortcutParams(launchOptions);
        const shortcutUrl =  this.bsmProtocolService.buildLink("launch", shortcutParams).toString();

        const shortcutName = ["Beat Saber", launchOptions.version.BSVersion, launchOptions.version.name].join(" ");
        const shortcutIconColor = new Color(launchOptions.version.color, "hex");

        return execOnOs({
            win32: async () => (
                shell.writeShortcutLink(path.join(app.getPath("desktop"), `${shortcutName}.lnk`), {
                    target: shortcutUrl,
                    icon: await this.createShortcutIco(shortcutIconColor),
                    iconIndex: 0,
                    description: [shortcutName, launchOptions.version.color].join(" "), // <= Need color in description to help windows know that the shortcut is different
                })
            ),
            linux: async () => (
                createDesktopUrlShortcut(path.join(app.getPath("desktop"), `${shortcutName}.desktop`), {
                    name: shortcutName,
                    url: shortcutUrl,
                    icon: await this.createShortcutPng(shortcutIconColor),
                })
            )
        })

    }

    private async openShortcutLaunchWindow(launchOptions: ShortcutParams): Promise<void>{
        const launchOption = this.shortcutParamsToLaunchOption(launchOptions);

        const bsPath = await this.localVersionService.getInstalledVersionPath(launchOption.version);

        launchOption.version = await this.localVersionService.getVersionOfBSFolder(bsPath, {
            steam: launchOption.version.steam,
            oculus: launchOption.version.oculus,    
        });

        launchOption.version = {...(await this.remoteVersion.getVersionDetails(launchOption.version.BSVersion)), ...launchOption.version};
        
        this.ipc.once("shortcut-launch-options", (_data, reply) => {
            reply(of(launchOption));
        });

        this.windows.openWindow("shortcut-launch.html");
    }
     
}

type ShortcutParams = {
    oculusMode?: string;
    desktopMode?: string;
    debug?: string;
    additionalArgs?: string[];
    version: string;
    versionName?: string;
    versionIno?: string;
    versionSteam?: string;
    versionOculus?: string;
}

/**
 * Create .desktop file for url shortcut (only for linux)
 * @param {string} shortcutPath 
 * @param options 
 * @returns 
 */
function createDesktopUrlShortcut(shortcutPath: string, options?: {
    url: string
    name: string,
    icon: string
}): Promise<boolean> {
    const { url, name, icon } = options || {};

    const data = [
        "[Desktop Entry]",
        "Type=Link",
        `Name=${name}`,
        `Icon=${icon}`,
        `URL=${url}`
    ].join("\n");

    return writeFile(shortcutPath, data).then(() => true);
}
