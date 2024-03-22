import { SupportersService } from "../services/supporters.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("get-supporters", (_, reply) => {
    const supportersService = SupportersService.getInstance();
    reply(from(supportersService.getSupporters()));
});
