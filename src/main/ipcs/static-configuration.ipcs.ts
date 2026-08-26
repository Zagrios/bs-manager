import { from, of, throwError } from "rxjs";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { IpcService } from "../services/ipc.service";
import { StaticConfigurationService } from "../services/static-configuration.service";

const ipc = IpcService.getInstance();
const staticConfig = StaticConfigurationService.getInstance();

ipc.on("static-configuration.get", (args, reply) => {
    reply(of(staticConfig.get(args)));
});

ipc.on("static-configuration.set", (args, reply) => {
    if (args.key === "proton-folder") {
        reply(throwError(() => new CustomError(
            "Proton folder writes must use linux.set-proton-folder",
            "PROTON_FOLDER_WRITE_FORBIDDEN"
        )));
        return;
    }

    reply(from(staticConfig.set(args.key, args.value)));
});

ipc.on("static-configuration.delete", (key, reply) => {
    reply(of(staticConfig.delete(key)));
});
