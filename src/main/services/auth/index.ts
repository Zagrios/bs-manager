import { shell } from "electron";
import { BsmProtocolService } from "../bsm-protocol.service";
import { WindowManagerService } from "../window-manager.service";

import { createBeatleaderAuthServerService } from "./beatleader-auth.service";
import { createAuthServerService } from "./auth.service";

const navigateLink = process.env.NODE_ENV === "development" && process.platform === "linux"
    ? (url: string) => WindowManagerService.getInstance().openWindow(url)
    : (url: string) => shell.openExternal(url);

BsmProtocolService.getInstance().on("oauth", link => {
    const url = new URL(link);
    WindowManagerService.getInstance().openWindow(`oauth.html${url.search}`);
});

function defaultBeatleaderAuthServerService() {
    return createBeatleaderAuthServerService({
        clientId: process.env.BEATLEADER_CLIENT_ID,
        redirectUri: process.env.BEATLEADER_REDIRECT_URI,
        navigateLink,
    });
}

export function defaultAuthServerService() {
    return createAuthServerService({
        beatleader: defaultBeatleaderAuthServerService,
    });
}
