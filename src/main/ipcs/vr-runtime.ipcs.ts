import { IpcService } from "../services/ipc.service";
import { VrRuntimeService } from "../services/vr-runtime.service";
import { from } from "rxjs";
import { tryit } from "shared/helpers/error.helpers";
import { parseEnvString } from "main/helpers/env.helpers";

const ipc = IpcService.getInstance();

ipc.on("vr-runtime.get-active", (launchCommand, reply) => {
    const launchEnvironment = tryit(() => parseEnvString(launchCommand ?? "").env).result;
    reply(from(VrRuntimeService.getInstance().getActiveRuntime(launchEnvironment)));
});
