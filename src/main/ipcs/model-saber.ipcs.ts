import { ModelSaberService } from "../services/thrid-party/model-saber/model-saber.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("ms-get-model-by-id", (args, reply) => {
    const ms = ModelSaberService.getInstance();
    reply(from(ms.getModelById(args)));
});

ipc.on("search-models", async (args, reply) => {
    const ms = ModelSaberService.getInstance();
    reply(ms.searchModels(args));
});
