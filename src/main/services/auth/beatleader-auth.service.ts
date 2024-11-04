import crypto from "crypto";
import querystring from "node:querystring";
import { OAuthServerService } from "./types";
import { OAuthType } from "shared/models/oauth.types";

// Configuration
const AUTHORIZE_ENDPOINT = "https://api.beatleader.xyz/oauth2/authorize";
const RESPONSE_TYPE = "code";
const CODE_CHALLENGE_METHOD = "S256";
// Offline access to get the refresh token
const SCOPE = "profile clan offline_access";

export function createBeatleaderAuthServerService({
    clientId,
    redirectUri,
    navigateLink,
}: {
    clientId: string;
    redirectUri: string;
    navigateLink: (url: string) => void;
}): OAuthServerService {
    return {
        openLink(codeVerifier) {
            const codeChallenge = crypto
                .createHash("sha256")
                .update(codeVerifier)
                .digest("base64")
                .replace(/=/g, "")
                .replace(/\+/g, "-")
                .replace(/\//g, "_");

            const query = querystring.stringify({
                response_type: RESPONSE_TYPE,
                client_id: clientId,
                code_challenge_method: CODE_CHALLENGE_METHOD,
                code_challenge: codeChallenge,
                redirect_uri: redirectUri,
                scope: SCOPE,
                state: OAuthType.Beatleader,
            });

            navigateLink(`${AUTHORIZE_ENDPOINT}?${query}`);
        },
    };
}
