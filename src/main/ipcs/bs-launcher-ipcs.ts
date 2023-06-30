
import { LaunchOption } from "shared/models/bs-launch";
import { BSLauncherService } from "../services/bs-launcher.service"
import { IpcRequest } from 'shared/models/ipc';
import { IpcService } from '../services/ipc.service';

const ipc = IpcService.getInstance();

ipc.on('bs-launch.launch', async (req: IpcRequest<LaunchOption>, reply) => {
    const bsLauncher = BSLauncherService.getInstance();
    reply(bsLauncher.launch(req.args));
});
