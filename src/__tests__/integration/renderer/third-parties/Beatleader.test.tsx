import crypto from "crypto";
import { Observable } from "rxjs";
import { OAuthType } from "shared/models/oauth.types";
import { createAuthClientService } from "renderer/services/auth.service";
import { createAuthServerService } from "main/services/auth/auth.service";
import { createBeatleaderAuthServerService } from "main/services/auth/beatleader-auth.service";
import { BeatleaderAuthInfo, createBeatleaderAPIClientService } from "renderer/services/third-parties/beatleader.service";
import { ConfigurationClientService, FetchOptions, FetchResponse, FetchService, IpcClientService } from "renderer/services/types";


const CLIENT_ID = "some-client-id";
const REDIRECT_URI = "https://bsmanager.io/oauth";
const CODE_VERIFIER_KEY = "some-random-key";

function toCodeChallengeS256(codeVerifier: string): string {
    return crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

test("Mocked Beatleader authentication flow", async () => {
    // *** Setup *** //
    let navigateLinkUrl = "";
    const navigateLink = (url: string) => {
        navigateLinkUrl = url;
    }

    const mockConfigMap: Record<string, any> = {};
    const mockConfigurationService: ConfigurationClientService = {
        get(key) {
            return mockConfigMap[key];
        },

        set(key, value) {
            mockConfigMap[key] = value;
        },

        delete(key) {
            delete mockConfigMap[key];
        },

        getAndDelete(key) {
            const value = mockConfigMap[key];
            delete mockConfigMap[key];
            return value;
        },
    }

    let ipcData: any;
    const mockIpcService: IpcClientService = {
        sendLazy() { },

        sendV2(_channel, data) {
            ipcData = data;
            return new Observable(observer => {
                observer.next();
                observer.complete();
            });
        }
    }

    const expectedPlayerId = "some-player-id";
    const expectedAccessToken = "some-access-token";
    const expectedRefreshToken = "some-refresh-token";
    const expectedScope = "some scope value";
    const fetchRequests: any[] = [];
    const mockFetchService: FetchService = {
        async get<T>(url: string, options?: FetchOptions) {
            fetchRequests.push({
                url,
                ...(options || {})
            });
            // Identity response
            return {
                status: 200,
                body: {
                    id: expectedPlayerId,
                }
            } as FetchResponse<T>;
        },

        async post<T>(url: string, options?: FetchOptions) {
            fetchRequests.push({
                url,
                ...(options || {})
            });
            // Token response
            return {
                status: 200,
                body: {
                    access_token: expectedAccessToken,
                    refresh_token: expectedRefreshToken,
                    expires_in: 3600,
                    scope: expectedScope,
                    state: OAuthType.Beatleader,
                }
            } as FetchResponse<T>;
        }
    };

    const beatleaderAuthServerService = createBeatleaderAuthServerService({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        navigateLink
    });
    const beatleaderAPIService = createBeatleaderAPIClientService({
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        codeVerifierKey: CODE_VERIFIER_KEY,
        configService: mockConfigurationService,
        fetchService: mockFetchService,
    });
    const authServerService = createAuthServerService({
        beatleader: () => beatleaderAuthServerService
    });
    const authClientService = createAuthClientService({
        codeVerifierKey: CODE_VERIFIER_KEY,
        configService: mockConfigurationService,
        ipcService: mockIpcService,
    });

    // *** Step 1 - Trigger the openOAuth button click *** //

    await authClientService.openOAuth(OAuthType.Beatleader);
    const codeVerifier = mockConfigurationService.get<string | undefined>(CODE_VERIFIER_KEY);
    expect(codeVerifier).toBeTruthy();

    expect(ipcData.type).toEqual(OAuthType.Beatleader);
    expect(ipcData.codeVerifier).toEqual(codeVerifier);

    // *** Step 2 - Open the OAuth authorization url *** //

    authServerService.openOAuth(OAuthType.Beatleader, codeVerifier);
    const { searchParams } = new URL(navigateLinkUrl);
    expect(searchParams.get("client_id")).toEqual(CLIENT_ID);
    expect(searchParams.get("redirect_uri")).toEqual(REDIRECT_URI);
    expect(searchParams.get("code_challenge_method")).toEqual("S256");

    // State string might be brittle if state can be an object string in the future
    const state = searchParams.get("state");
    const codeChallenge = searchParams.get("code_challenge");

    expect(state).toEqual(OAuthType.Beatleader);
    expect(toCodeChallengeS256(codeVerifier)).toEqual(codeChallenge);

    // *** Step 3 - Mock the callback to oauth.html *** //

    const code = "some-random-code";
    await beatleaderAPIService.verifyCode(code);

    // Verify if the body being passed is correct
    expect(fetchRequests.length).toEqual(2);
    const tokenBody = new URLSearchParams(fetchRequests[0].body);
    expect(tokenBody.get("client_id")).toEqual(CLIENT_ID);
    expect(tokenBody.get("code_verifier")).toEqual(codeVerifier);
    expect(tokenBody.get("redirect_uri")).toEqual(REDIRECT_URI);
    expect(tokenBody.get("code")).toEqual(code);

    expect(mockConfigurationService.get(CODE_VERIFIER_KEY)).toBeUndefined();

    // *** Step 4 - Check the configuration service if user data is correct *** //

    const authInfo = mockConfigurationService.get<BeatleaderAuthInfo>(OAuthType.Beatleader);
    expect(authInfo).toBeTruthy();
    expect(authInfo.playerId).toEqual(expectedPlayerId);
    expect(authInfo.authorization).toEqual(`Bearer ${expectedAccessToken}`);
    expect(authInfo.refreshToken).toEqual(expectedRefreshToken);
    expect(authInfo.scope).toEqual(expectedScope);
    // expires date > now
    expect(authInfo.expires.localeCompare(new Date().toISOString())).toBeGreaterThan(0);
});
