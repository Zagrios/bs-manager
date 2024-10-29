import { CODE_VERIFIER_KEY } from "renderer/consts";
import { createBeatleaderAPIClientService } from "./beatleader.service";
import { configClientService } from "../configuration.service";
import { fetchService } from "../fetch.service";


export function defaultBeatleaderAPIClientService() {
    const { clientId, redirectUri } = window.electron.envVariables.beatleader;
    return createBeatleaderAPIClientService({
        clientId,
        redirectUri,
        codeVerifierKey: CODE_VERIFIER_KEY,
        configService: configClientService,
        fetchService,
    });
}

