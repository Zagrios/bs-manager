import { lastValueFrom } from "rxjs";
import { IpcService } from "../ipc.service";
import { OAuthType } from "shared/models/oauth.types";
import { ConfigurationService } from "../configuration.service";

const CODE_VERIFIER_SIZE = 64;
const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

function randomString(length: number): string {
    let str = "";
    while (--length >= 0) {
        str += CHARACTERS.charAt(Math.floor(Math.random() * CHARACTERS.length));
    }
    return str;
}

export function createAuthClientService({
    codeVerifierKey,
    configService,
    ipcService,
}: {
    codeVerifierKey: string;
    configService: ConfigurationService;
    ipcService: IpcService;
}) {
    return {
        async openOAuth(type: OAuthType) {
            const codeVerifier = randomString(CODE_VERIFIER_SIZE);
            configService.set(codeVerifierKey, codeVerifier);
            return lastValueFrom(
                ipcService.sendV2("auth.open-oauth", {
                    type,
                    codeVerifier,
                })
            );
        },

        async logoutOAuth(type: OAuthType) {
            configService.delete(type);
        }
    };
}
