import { createAuthClientService } from "./auth.service";
import { createBeatleaderAuthClientService } from "./beatleader.service";
import { createFetchService } from "./fetch.service";
import { ConfigurationService } from "../configuration.service";
import { IpcService } from "../ipc.service";

const codeVerifierKey = "code-verifier";

const configService = ConfigurationService.getInstance();
const ipcService = IpcService.getInstance();

// TODO: Should be static somewhere
export const fetchService = createFetchService();

export function defaultAuthService() {
    return createAuthClientService({
        codeVerifierKey,
        configService,
        ipcService,
    });
}

export function defaultBeatleaderAuthClientService() {
    const { clientId, redirectUri } = window.electron.envVariables.beatleader;
    return createBeatleaderAuthClientService({
        clientId,
        redirectUri,
        codeVerifierKey,
        configService,
        fetchService,
    });
}
