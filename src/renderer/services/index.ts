import { CODE_VERIFIER_KEY } from "renderer/consts";
import { createAuthClientService } from "./auth.service";
import { ipcClientService } from "./ipc.service";
import { configClientService } from "./configuration.service";

export function defaultAuthService() {
    return createAuthClientService({
        codeVerifierKey: CODE_VERIFIER_KEY,
        configService: configClientService,
        ipcService: ipcClientService,
    });
}
