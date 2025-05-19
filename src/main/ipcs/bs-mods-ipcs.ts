import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";
import { BeatModsApiService } from "main/services/mods/beat-mods-api.service";

const ipc = IpcService.getInstance();

ipc.on("bs-mods.get-available-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getAvailableMods(args)));
});

ipc.on("bs-mods.get-installed-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getInstalledMods(args)));
});

ipc.on("bs-mods.is-modded", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.isModded(args)));
});

ipc.on("bs-mods.import-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(modsManager.importMods(args.paths, args.version));
});

ipc.on("bs-mods.install-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(modsManager.installMods(args.mods, args.version));
});

ipc.on("bs-mods.uninstall-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(modsManager.uninstallMods(args.mods, args.version));
});

ipc.on("bs-mods.uninstall-all-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(modsManager.uninstallAllMods(args));
});

ipc.on("bs-mods.beatmods-up", (_, reply) => {
    const beatMods = BeatModsApiService.getInstance();
    reply(from(beatMods.isUp()));
});

