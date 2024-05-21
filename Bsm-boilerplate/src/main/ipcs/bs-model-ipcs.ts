import { LocalModelsManagerService } from "../services/additional-content/local-models-manager.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("one-click-install-model", (args, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(from(models.oneClickDownloadModel(args)));
});

ipc.on("register-models-deep-link", (_, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(of(models.enableDeepLinks()));
});

ipc.on("unregister-models-deep-link", (_, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(of(models.disableDeepLinks()));
});

ipc.on("is-models-deep-links-enabled", (_, reply) => {
    const maps = LocalModelsManagerService.getInstance();
    reply(of(maps.isDeepLinksEnabled()));
});

ipc.on("download-model", (args, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(models.downloadModel(args.model, args.version));
});

ipc.on("get-version-models", (args, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(from(models.getModels(args.type, args.version)));
});

ipc.on("export-models", (args, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(models.exportModels(args.outPath, args.version, args.models));
});

ipc.on("delete-models", (args, reply) => {
    const models = LocalModelsManagerService.getInstance();
    reply(models.deleteModels(args));
});
