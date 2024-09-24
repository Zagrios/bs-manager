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

ipc.on("bs-mods.uninstall-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.uninstallMods(args.mods, args.externalMods, args.version)));
});

ipc.on("bs-mods.uninstall-all-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.uninstallAllMods(args)));
});

ipc.on("bs-mods.get-installed-external-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getInstalledExternalMods(args)));
});

ipc.on("bs-mods.verify-external-mod-files", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.verifyExternalModFiles(args.version, args.files)));
});

ipc.on("bs-mods.install-external-mod", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
   reply(from(modsManager.installExternalMod(args.mod, args.version, args.files)));
});

