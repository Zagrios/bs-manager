import { lastValueFrom } from "rxjs";
import { OAuthType } from "shared/models/oauth.types";
import { ConfigurationClientService, IpcClientService } from "./types";


const CODE_VERIFIER_SIZE = 32;

function createCodeVerifier(): string {
    const random = new Uint8Array(CODE_VERIFIER_SIZE);
    crypto.getRandomValues(random);
    return btoa(String.fromCharCode.apply(null, Array.from(random)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

export function createAuthClientService({
    codeVerifierKey,
    configService,
    ipcService,
}: {
    codeVerifierKey: string;
    configService: ConfigurationClientService;
    ipcService: IpcClientService;
}) {
    return {
        async openOAuth(type: OAuthType) {
            const codeVerifier = createCodeVerifier();
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

