
import { LaunchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher/bs-launcher.service"
import { IpcService } from '../services/ipc.service';
import { from } from "rxjs";
import { SteamLauncherService } from "../services/bs-launcher/steam-launcher.service";
import { OculusLauncherService } from "../services/bs-launcher/oculus-launcher.service";

const ipc = IpcService.getInstance();

ipc.on<LaunchOption>('bs-launch.launch', (req, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(bsLauncher.launch(req.args));
});

ipc.on<LaunchOption>("create-launch-shortcut", (req, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(from(bsLauncher.createLaunchShortcut(req.args)));
});

ipc.on<void>("bs-launch.restore-steamvr", (_, reply) => {
    const steamLauncher = SteamLauncherService.getInstance();
    reply(from(steamLauncher.restoreSteamVR()));
});

ipc.on<void>("restore-original-oculus-folder", (_, reply) => {
    const oculusLauncher = OculusLauncherService.getInstance();
    reply(from(
        oculusLauncher.deleteBsSymlinks().then(() => oculusLauncher.restoreOriginalBeatSaber())
    ));
});
