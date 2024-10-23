import { LinuxService } from "main/services/linux.service";
import { IpcService } from "../services/ipc.service";
import { of } from "rxjs";

const ipc = IpcService.getInstance();
const linuxService = LinuxService.getInstance();

ipc.on("linux.verify-proton-folder", (_, reply) => {
    reply(of(linuxService.verifyProtonPath()));
});

