import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("get-available-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getAvailableMods(args)));
});

ipc.on("get-installed-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getInstalledMods(args)));
});

ipc.on("install-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.installMods(args.mods, args.version)));
});

ipc.on("uninstall-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.uninstallMods(args.mods, args.version)));
});

ipc.on("uninstall-all-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.uninstallAllMods(args)));
});
