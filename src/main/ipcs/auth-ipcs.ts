import { of } from "rxjs";
import { defaultAuthServerService } from "main/services/auth";
import { IpcService } from "main/services/ipc.service";

const ipc = IpcService.getInstance();

ipc.on("auth.open-oauth", (args, reply) => {
    const auth = defaultAuthServerService();
    reply(of(auth.openOAuth(args.type, args.codeVerifier)));
});
