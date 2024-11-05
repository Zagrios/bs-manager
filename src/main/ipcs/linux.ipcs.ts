import { LinuxService } from "main/services/linux.service";
import { IpcService } from "../services/ipc.service";
import { of } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("linux.verify-proton-folder", (_, reply) => {
    const linuxService = LinuxService.getInstance();
    reply(of(linuxService.verifyProtonPath()));
});

