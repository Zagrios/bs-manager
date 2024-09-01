import { of } from "rxjs";
import { IpcService } from "../services/ipc.service";
import { StaticConfigurationService } from "../services/static-configuration.service";

const ipc = IpcService.getInstance();
const staticConfig = StaticConfigurationService.getInstance();

ipc.on("static-configuration.get", (args, reply) => {
    reply(of(staticConfig.get(args)));
});

ipc.on("static-configuration.set", (args, reply) => {
    reply(of(staticConfig.set(args.key, args.value)));
});
