
import { LaunchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcService } from '../services/ipc.service';
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on<LaunchOption>('bs-launch.launch', (req, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(bsLauncher.launch(req.args));
});

ipc.on<LaunchOption>("create-launch-shortcut", (req, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(from(bsLauncher.createLaunchShortcut(req.args)));
});
