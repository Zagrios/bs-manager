
import { BSLauncherService } from "../services/bs-launcher/bs-launcher.service"
import { IpcService } from '../services/ipc.service';
import { from } from "rxjs";
import { SteamLauncherService } from "../services/bs-launcher/steam-launcher.service";
import { SteamService } from "../services/steam.service";
import log from "electron-log";
import isElevated from "is-elevated";

const ipc = IpcService.getInstance();

ipc.on('bs-launch.launch', (args, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(bsLauncher.launch(args));
});

ipc.on("bs-launch.need-start-as-admin", (_, reply) => {
    const steam = SteamService.getInstance();
    reply(from(isElevated().then(elevated => {
        if(elevated){ return false; }
        return steam.isElevated().catch(e => {
            log.error("Error while checking if Steam is running as admin", e);
            return false;
        });
    })));
});

ipc.on("create-launch-shortcut", (args, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(from(bsLauncher.createLaunchShortcut(args)));
});

ipc.on("bs-launch.restore-steamvr", (_, reply) => {
    const steamLauncher = SteamLauncherService.getInstance();
    reply(from(steamLauncher.restoreSteamVR()));
});
