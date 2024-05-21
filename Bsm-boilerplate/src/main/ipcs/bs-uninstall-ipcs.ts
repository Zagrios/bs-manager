import { BSLocalVersionService } from "../services/bs-local-version.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("bs.uninstall", (args, reply) => {
    const bsLocalVersionService = BSLocalVersionService.getInstance();
    reply(from(bsLocalVersionService.deleteVersion(args)));
});
