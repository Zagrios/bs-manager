import log from "electron-log";
import { OAuthType } from "shared/models/oauth.types";
import { OAuthServerService } from "./types";

export function createAuthServerService({
    beatleader
}: {
    beatleader: () => OAuthServerService;
}) {
    const oauthHandlers: Record<OAuthType, () => OAuthServerService> = {
        [OAuthType.Beatleader]: beatleader,
    };

    return {
        openOAuth(type: OAuthType, codeVerifier: string) {
            const handler = oauthHandlers[type];
            if (!handler) {
                log.error("No OAuth handler for", type);
                return;
            }

            handler().openLink(codeVerifier);
        }
    };
}
