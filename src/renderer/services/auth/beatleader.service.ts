import { OAuthType } from "shared/models/oauth.types";
import { ConfigurationService } from "../configuration.service";
import { FetchService } from "./fetch.service";

const BEATLEADER_GRANT_TYPE = "authorization_code";

const API_ENDPOINT = "https://api.beatleader.xyz";
const TOKEN_ENDPOINT = `${API_ENDPOINT}/oauth2/token`;
const IDENTITY_ENDPOINT = `${API_ENDPOINT}/oauth2/identity`;

export function createBeatleaderAuthClientService({
    clientId,
    redirectUri,
    codeVerifierKey,
    configService,
    fetchService,
}: {
    clientId: string;
    redirectUri: string;
    codeVerifierKey: string;
    configService: ConfigurationService;
    fetchService: FetchService;
}) {
    return {
        async verifyCode(code: string): Promise<void> {
            const codeVerifier = configService.get<string | undefined>(codeVerifierKey);
            configService.delete(codeVerifierKey);

            if (!codeVerifier) {
                throw new Error("code is null");
            }

            if (!code) {
                throw new Error("code-verifier is null");
            }

            const body = new URLSearchParams({
                client_id: clientId,
                code_verifier: codeVerifier,
                grant_type: BEATLEADER_GRANT_TYPE,
                redirect_uri: redirectUri,
                code,
            }).toString();

            const tokenResponse = await fetchService.post(TOKEN_ENDPOINT, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });
            if (tokenResponse.status !== 200) {
                throw new Error(`Token endpoint response error: ${tokenResponse}`);
            }
            const tokenJson = tokenResponse.body;

            const authorization = `Bearer ${tokenJson.access_token}`;
            const identityResponse = await fetchService.get(IDENTITY_ENDPOINT, {
                headers: {
                    Authorization: authorization,
                },
            });
            if (identityResponse.status !== 200) {
                throw new Error(`Identity endpoint response error: ${identityResponse}`);
            }

            const expires = new Date();
            expires.setSeconds(expires.getSeconds() + tokenJson.expires_in);

            const beatleaderConfig = {
                playerId: identityResponse.body.id,
                authorization,
                refreshToken: tokenJson.refresh_token,
                expires,
                scope: tokenJson.scope,
            };
            // Just reuse the enum as the config key
            configService.set(OAuthType.Beatleader, JSON.stringify(beatleaderConfig));
        },
    };
}
