export enum OAuthType {
    Beatleader = "beatleader",
}

// https://www.oauth.com/oauth2-servers/access-tokens/access-token-response/
export interface OAuthTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    state?: string;
    token_type: string; // Bearer,Basic
}
