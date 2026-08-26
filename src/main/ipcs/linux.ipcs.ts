import { LinuxService } from "main/services/linux.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("linux.set-proton-folder", (protonFolder, reply) => {
    const linuxService = LinuxService.getInstance();
    reply(from(linuxService.setProtonFolder(protonFolder)));
});

ipc.on("linux.verify-proton-folder", (protonFolder, reply) => {
    const linuxService = LinuxService.getInstance();
    reply(of(linuxService.verifyProtonPath(protonFolder || "")));
});

ipc.on("linux.get-wine-prefix-path", (_, reply) => {
    const linuxService = LinuxService.getInstance();
    reply(of(linuxService.getWinePrefixPath()));
});
