import { formatAccuracy, formatInt, formatPp } from "renderer/helpers/leaderboard";
import { LeaderboardColumn, LeaderboardScore } from "shared/models/leaderboard.types";
import { OAuthTokenResponse, OAuthType } from "shared/models/oauth.types";
import { SongDetailDiffCharactertistic, SongDiffName } from "shared/models/maps";
import { ConfigurationClientService, FetchService } from "../types";
import BeatleaderIcon from "../../../../assets/images/third-party-icons/beat-leader.png";

const CODE_GRANT_TYPE = "authorization_code";
const REFRESH_TOKEN_GRANT_TYPE = "refresh_token";

const API_ENDPOINT = "https://api.beatleader.xyz";
const TOKEN_ENDPOINT = `${API_ENDPOINT}/oauth2/token`;
const IDENTITY_ENDPOINT = `${API_ENDPOINT}/oauth2/identity`;

const COLUMNS: LeaderboardColumn[] = [
    {
        header: "Rank",
        key: "rank",
        textAlignment: "center",
        formatter: formatInt,
    },
    {
        header: "Player",
        key: "player",
    },
    {
        header: "Score",
        key: "score",
        textAlignment: "right",
        font: "mono",
        formatter: formatInt,
    },
    {
        header: "Mods",
        key: "mods",
        textAlignment: "center",
        default: "-",
    },
    {
        header: "Acc",
        key: "accuracy",
        textAlignment: "right",
        font: "mono",
        formatter: formatAccuracy,
    },
    {
        header: "PP",
        key: "pp",
        textAlignment: "right",
        font: "mono",
        formatter: formatPp,
        default: "0pp",
        // NOTE: Some songs that are blRanked are sometimes undefined
        // condition: (map: BsmLocalMap) => map.songDetails?.blRanked,
    },
];

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

        getTitle(): string {
            return "BeatLeader";
        },

        getIcon(): string {
            return BeatleaderIcon;
        },

        getColumns(): LeaderboardColumn[] {
            return COLUMNS;
        },

        async getCurrentPlayerInfo(): Promise<BeatleaderPlayerInfo | null> {
            const authInfo = getAuthInfo();
            const response = await fetchService.get<BeatleaderPlayerInfo>(`${API_ENDPOINT}/player/${authInfo.playerId}`);
            if (response.status !== 200) {
                return null;
            }

            return response.body;
        },

        async getMapPlayerHighscore(
            hash: string,
            characteristic: SongDetailDiffCharactertistic,
            difficulty: SongDiffName
        ): Promise<LeaderboardScore | null> {
            const authInfo = getAuthInfo();
            const response = await fetchService.get<BeatleaderSimpleScore>(`${API_ENDPOINT}/score/${authInfo.playerId}/${hash}/${difficulty}/${characteristic}`);
            if (response.status !== 200) {
                return null;
            }

            const score = response.body;
            return {
                id: score.id.toString(),
                rank: score.rank,
                player: (score.player as BeatleaderPlayerInfo).name,
                score: score.modifiedScore,
                mods: score.modifiers,
                accuracy: score.accuracy,
                pp: score.pp,
            };
        },

        async getMapScores(
            hash: string,
            characteristic: SongDetailDiffCharactertistic,
            difficulty: SongDiffName,
            page: number = 1,
            count: number = 10
        ): Promise<{
            scores: LeaderboardScore[];
            total: number;
        }> {
            const response = await fetchService.get<{
                data: BeatleaderSimpleScore[];
                metadata: { total: number };
            }>(`${API_ENDPOINT}/v5/scores/${hash}/${difficulty}/${characteristic}`, {
                query: { page, count }
            });
            if (response.status !== 200) {
                throw new Error("scores not found");
            }

            return {
                scores: response.body.data.map(
                    (score): LeaderboardScore => ({
                        id: score.id.toString(),
                        rank: score.rank,
                        player: score.player as string,
                        score: score.modifiedScore,
                        mods: score.modifiers,
                        accuracy: score.accuracy,
                        pp: score.pp,
                    })
                ),
                total: response.body.metadata.total,
            };
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

export interface BeatleaderSimpleScore {
    id: number;
    rank: number;
    // baseScore: number;
    modifiedScore: number;
    modifiers: string;
    accuracy: number;
    pp: number;
    // Can either be BeatleaderPlayerInfo or string (player name)
    player: BeatleaderPlayerInfo | string;
}
