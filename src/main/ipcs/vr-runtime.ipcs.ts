import { IpcService } from "../services/ipc.service";
import { VrRuntimeService } from "../services/vr-runtime.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("vr-runtime.get-active", (_, reply) => {
    reply(from(VrRuntimeService.getInstance().getActiveRuntime()));
});
