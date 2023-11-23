import { BSLauncherService } from "../bs-launcher/bs-launcher.service";
import { LivEntry, LivService } from "./liv.service";
import { LaunchOption } from "shared/models/bs-launch";
import { app } from "electron";
import { BSLocalVersionService } from "../bs-local-version.service";
import { BSVersion } from "shared/bs-version.interface";
import { debounceTime, distinctUntilChanged, map } from "rxjs";
import equal from "fast-deep-equal";
import sanitize from "sanitize-filename";
import { tryit } from "../../../shared/helpers/error.helpers";
import log from "electron-log"

export class LivShortcut {

    private static instance: LivShortcut;

    public static getInstance(): LivShortcut {
        if (!LivShortcut.instance) {
            LivShortcut.instance = new LivShortcut();
        }
        return LivShortcut.instance;
    }

    private readonly LIV_ID_PREFIX = "BSManager";

    private readonly liv: LivService;
    private readonly launcher: BSLauncherService;
    private readonly versionManager: BSLocalVersionService;

    private constructor() {
        this.liv = LivService.getInstance();
        this.launcher = BSLauncherService.getInstance();
        this.versionManager = BSLocalVersionService.getInstance();

        this.liv.isLivInstalled().then(installed => {
            if(!installed){ return; }

            this.versionManager.loadedVersions$.pipe(debounceTime(1000), distinctUntilChanged((prev, curr) => equal(prev, curr)), map(versions => versions.filter(v => !v.steam))).subscribe(versions => {
                (async () => {
                    const clearedLaunchOptions = (await this.clearLivShortcuts().catch(() => [] as LivEntry[]))?.map(entry => {
                        return tryit(() => this.launcher.shortcutLinkToLaunchOptions(entry.arguments)).result;
                    });
                    
                    versions.forEach(version => this.createLivShortcut({ 
                        ...(clearedLaunchOptions?.find(launchOpt => launchOpt.version.ino === version.ino) ?? {}),
                        version
                    }));
                })().catch(err => log.error("Error while creating LIV shortcuts", err));
            });
        });
    }

    private buildShortcutId(version: BSVersion): string {
        const name = (() => {
            if(version.steam){ return "Steam"; }
            if(version.oculus){ return "Oculus"; }
            return version.name;
        })();
        return sanitize([this.LIV_ID_PREFIX, name, version.BSVersion].filter(Boolean).join("-").replaceAll(".", "-").replaceAll(" ", "-"));
    }

    private buildShortcutName(version: BSVersion): string {
        const name = (() => {
            if(version.steam){ return "Steam"; }
            if(version.oculus){ return "Oculus"; }
            return version.name;
        })();
        return ["Beat Saber", name, `v${version.BSVersion}`].filter(Boolean).join(" ");
    }

    private async buildLivEntry(launchOptions: LaunchOption): Promise<LivEntry> {
        return {
            id: this.buildShortcutId(launchOptions.version),
            name: this.buildShortcutName(launchOptions.version),
            installPath: await this.versionManager.getInstalledVersionPath(launchOptions.version),
            executable: app.getPath("exe"),
            arguments: this.launcher.createLaunchLink(launchOptions)
        };
    }

    private createLivShortcut(launchOptions: LaunchOption): Promise<void>{
        return this.buildLivEntry(launchOptions).then(entry => this.liv.createLivShortcut(entry)); 
    }

    private async clearLivShortcuts(): Promise<LivEntry[]>{
        const bsmShortcuts = (await this.liv.getLivShortcuts()).reduce((acc, shortcut) => {
            if(shortcut.id?.startsWith(this.LIV_ID_PREFIX)){
                acc.push(shortcut);
            }
            return acc;
        }, [] as LivEntry[]);

        return this.liv.deleteLivShortcuts(bsmShortcuts.map(shortcut => shortcut.id)).then(() => bsmShortcuts);
    }

}