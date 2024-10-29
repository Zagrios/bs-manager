import { OAuthTokenResponse, OAuthType } from "shared/models/oauth.types";
import { ConfigurationClientService, FetchService } from "../types";


const CODE_GRANT_TYPE = "authorization_code";
const REFRESH_TOKEN_GRANT_TYPE = "refresh_token";

const API_ENDPOINT = "https://api.beatleader.xyz";
const TOKEN_ENDPOINT = `${API_ENDPOINT}/oauth2/token`;
const IDENTITY_ENDPOINT = `${API_ENDPOINT}/oauth2/identity`;


export function createBeatleaderAPIClientService({
    clientId,
    redirectUri,
    codeVerifierKey,
    configService,
    fetchService
}: {
    clientId: string;
    redirectUri: string;
    codeVerifierKey: string;
    configService: ConfigurationClientService;
    fetchService: FetchService;
}) {
    function getAuthInfo(): BeatleaderAuthInfo {
        const authInfo = configService.get<BeatleaderAuthInfo | undefined>(OAuthType.Beatleader);
        if (!authInfo) {
            throw new Error("Unauthenticated");
        }
        return authInfo;
    }

    return {
        async verifyCode(code: string): Promise<void> {
            const codeVerifier = configService.getAndDelete<string | undefined>(codeVerifierKey);
            if (!codeVerifier) {
                throw new Error("Code verifier is null");
            }

            if (!code) {
                throw new Error("code is null");
            }

            const body = new URLSearchParams({
                client_id: clientId,
                code_verifier: codeVerifier,
                grant_type: CODE_GRANT_TYPE,
                redirect_uri: redirectUri,
                code,
            }).toString();

            const tokenResponse = await fetchService.post<OAuthTokenResponse>(TOKEN_ENDPOINT, {
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
            const identityResponse = await fetchService.get<{ id: string }>(IDENTITY_ENDPOINT, {
                headers: {
                    Authorization: authorization,
                },
            });
            if (identityResponse.status !== 200) {
                throw new Error(`Identity endpoint response error: ${identityResponse}`);
            }

            const expires = new Date();
            expires.setSeconds(expires.getSeconds() + tokenJson.expires_in);

            const authInfo: BeatleaderAuthInfo = {
                playerId: identityResponse.body.id,
                authorization,
                refreshToken: tokenJson.refresh_token,
                expires: expires.toISOString(),
                scope: tokenJson.scope,
            };
            // Just reuse the enum as the config key
            configService.set(OAuthType.Beatleader, authInfo);
        },

        async refreshToken(): Promise<void> {
            const authInfo = getAuthInfo();

            const body = new URLSearchParams({
                client_id: clientId,
                refresh_token: authInfo.refreshToken,
                grant_type: REFRESH_TOKEN_GRANT_TYPE,
            }).toString();

            const tokenResponse = await fetchService.post<OAuthTokenResponse>(TOKEN_ENDPOINT, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            });
            if (tokenResponse.status !== 200) {
                throw new Error(`Token endpoint response error: ${tokenResponse}`);
            }

            const tokenJson = tokenResponse.body;
            const expires = new Date();
            expires.setSeconds(expires.getSeconds() + tokenJson.expires_in);

            authInfo.authorization = `Bearer ${tokenJson.access_token}`;
            authInfo.expires = expires.toISOString();
            if (tokenJson.refresh_token) {
                authInfo.refreshToken = tokenJson.refresh_token;
            }
            configService.set(OAuthType.Beatleader, authInfo);
        },

        isAuthenticated(): boolean {
            return !!configService.get<string | undefined>(OAuthType.Beatleader);
        },

        async getCurrentPlayerInfo(): Promise<BeatleaderPlayerInfo | null> {
            const authInfo = getAuthInfo();
            const response = await fetchService.get<BeatleaderPlayerInfo>(`${API_ENDPOINT}/player/${authInfo.playerId}`);
            if (response.status !== 200) {
                return null;
            }

            return response.body;
        },
    };
}

// Types
export interface BeatleaderAuthInfo {
    playerId: string;
    authorization: string;
    refreshToken: string;
    expires: string;
    scope: string;
}

export interface BeatleaderScoreStats {
    topPlatform: string;
    totalScore: number;
    totalRankedScore: number;
    averageWeightedRankedAccuracy: number;
    averageAccuracy: number;
    medianRankedAccuracy: number;
    medianAccuracy: number;
    topRankedAccuracy: number;
    topAccuracy: number;
    averageWeightedRankedRank: number;
    peakRank: number;
    topPercentile: number;
    countryTopPercentile: number;

    averageRankedAccuracy: number;
    topPp: number;
    rankedPlayCount: number;
    unrankedPlayCount: number;
    totalPlayCount: number;
    averageRank: number;

    sspPlays: number; // SS+
    ssPlays: number; // SS
    spPlays: number; // S+
    sPlays: number; // S
}

export interface BeatleaderSocial {
    id: number;
    service: string;
    link: string;
    user: string;
    userId: string;
    playerId: string;
    hidden: boolean;
}

export interface BeatleaderPlayerInfo {
    id: string;
    name: string;
    avatar: string;
    pp: number;
    rank: number;
    country: string;
    countryRank: number;
    externalProfileUrl: string; // Can be steam
    scoreStats: BeatleaderScoreStats;
    socials: BeatleaderSocial[];
}
