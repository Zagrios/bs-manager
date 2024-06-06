import { BsModsManagerService } from "../services/mods/bs-mods-manager.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";
import { BeatModsApiService } from "main/services/mods/beat-mods-api.service";

const ipc = IpcService.getInstance();

ipc.on("get-version-mods", (args, reply) => {
    const beatMods = BeatModsApiService.getInstance();
    reply(from(beatMods.getVersionMods(args)));
});

ipc.on("get-installed-mods", (args, reply) => {
    const modsManager = BsModsManagerService.getInstance();
    reply(from(modsManager.getInstalledMods(args)));
});

ipc.on("get-version-aliases", (_, reply) => {
    const beatmods = BeatModsApiService.getInstance();
    reply(from(beatmods.getVersionAliases()));
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
