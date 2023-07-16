import { BSVersion } from "shared/bs-version.interface";
import { BSLocalVersionService } from "../services/bs-local-version.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on<BSVersion>("bs.uninstall", (req, reply) => {
    const bsLocalVersionService = BSLocalVersionService.getInstance();

    reply(from(bsLocalVersionService.deleteVersion(req.args)));
});
