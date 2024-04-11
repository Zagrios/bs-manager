import path from "path";
import { LaunchOption, BSLaunchEventData } from "../../../shared/models/bs-launch";
import { IMAGE_CACHE_PATH } from "../../constants";
import { BSLocalVersionService } from "../bs-local-version.service";
import log from "electron-log";
import { Observable, of, throwError } from "rxjs";
import { BsmProtocolService } from "../bsm-protocol.service";
import { app, shell} from "electron";
import Color from "color";
import { ensureDir, writeFile } from "fs-extra";
import toIco from "to-ico";
import { objectFromEntries } from "../../../shared/helpers/object.helpers";
import { WindowManagerService } from "../window-manager.service";
import { IpcService } from "../ipc.service";
import { BSVersionLibService } from "../bs-version-lib.service";
import { execOnOs } from "../../helpers/env.helpers";
import { Resvg } from "@resvg/resvg-js";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { SteamLauncherService } from "./steam-launcher.service";
import { OculusLauncherService } from "./oculus-launcher.service";
import { BSVersion } from "shared/bs-version.interface";
import { BsStore } from "../../../shared/models/bs-store.enum";

export class BSLauncherService {
    private static instance: BSLauncherService;

    private readonly localVersionService: BSLocalVersionService;
    private readonly bsmProtocolService: BsmProtocolService;
    private readonly windows: WindowManagerService;
    private readonly ipc: IpcService;
    private readonly remoteVersion: BSVersionLibService;
    private readonly steamLauncher: SteamLauncherService;
    private readonly oculusLauncher: OculusLauncherService;

    public static getInstance(): BSLauncherService {
        if (!BSLauncherService.instance) {
            BSLauncherService.instance = new BSLauncherService();
        }
        return BSLauncherService.instance;
    }

    private constructor() {
        this.localVersionService = BSLocalVersionService.getInstance();
        this.bsmProtocolService = BsmProtocolService.getInstance();
        this.windows = WindowManagerService.getInstance();
        this.ipc = IpcService.getInstance();
        this.remoteVersion = BSVersionLibService.getInstance();
        this.steamLauncher = SteamLauncherService.getInstance();
        this.oculusLauncher = OculusLauncherService.getInstance();

        this.bsmProtocolService.on("launch", link => {
            log.info("Launch from bsm protocol", link.toString());
            this.openShortcutLaunchWindow(this.shortcutLinkToShortcutParams(link)).catch(log.error);
        });
    }

    private getStoreLauncherFromVersion(version: BSVersion): StoreLauncherInterface {
        if(version.steam){ return this.steamLauncher; }
        if(version.oculus){ return this.oculusLauncher; }
        if(version.metadata?.store === BsStore.STEAM){ return this.steamLauncher; }
        if(version.metadata?.store === BsStore.OCULUS){ return this.oculusLauncher; }
        return this.steamLauncher;
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>{

        log.info("Launch version", launchOptions);

        const launcher = this.getStoreLauncherFromVersion(launchOptions.version);

        if(!launcher){
            return throwError(() => new Error("Unable to get launcher for the provided version"));
        }

        return launcher.launch(launchOptions);
    }

    public shortcutLinkToShortcutParams(shortcutLink: string|URL): ShortcutParams{
        if(typeof shortcutLink === "string"){
            shortcutLink = new URL(shortcutLink);
        }

        const params = objectFromEntries(shortcutLink.searchParams.entries()) as ShortcutParams;

        if(typeof params.additionalArgs === "string"){
            params.additionalArgs = [params.additionalArgs];
        }

        return params;
    }

    public shortcutLinkToLaunchOptions(shortcutLink: string|URL): LaunchOption{
        return this.shortcutParamsToLaunchOption(this.shortcutLinkToShortcutParams(shortcutLink));
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

        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 406.4 406.4" height="406.4" width="406.4">
                <rect rx="69.453" height="406.4" width="406.4" fill="${color.hex()}"/>
                <path d="M65.467 60.6H336.4v33.867L200.933 162.2 65.467 94.467z" fill="#fff"/>
            </svg>
        `;

        return new Resvg(svg, {
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
        const pngBuffer = await this.createShortcutPngBuffer(color);
        const icoBuffer = await toIco([pngBuffer]);

        await ensureDir(IMAGE_CACHE_PATH);

        const iconPath = path.join(IMAGE_CACHE_PATH, `launch_shortcut_${color.hex()}.ico`);

        await writeFile(iconPath, icoBuffer);

        return iconPath;
    }

    public createLaunchLink(launchOptions: LaunchOption): string{
        const shortcutParams = this.launchOptionToShortcutParams(launchOptions);
        return this.bsmProtocolService.buildLink("launch", shortcutParams).toString();
    }

    public async createLaunchShortcut(launchOptions: LaunchOption): Promise<boolean>{
        const shortcutUrl =  this.createLaunchLink(launchOptions);

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

        const bsPath: string = await (async () => {
            const bsPath = await this.localVersionService.getInstalledVersionPath(launchOption.version);
            return bsPath ?? this.localVersionService.getVersionPath(launchOption.version);
        })().catch(e => {
            log.error(e);
            return null;
        });

        launchOption.version = (await this.localVersionService.getVersionOfBSFolder(bsPath, {
            steam: launchOption.version.steam,
            oculus: launchOption.version.oculus,
        })) ?? launchOption.version;

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
