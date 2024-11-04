export interface OAuthServerService {
    openLink(codeVerifier: string): void;
}
