import { defaultAuthService } from "renderer/services/auth";
import { BsmButton } from "../shared/bsm-button.component";
import { OAuthType } from "shared/models/oauth.types";

export function LeaderboardPanel() {
    const { openOAuth, logoutOAuth } = defaultAuthService();

    // TODO: UI
    return <div>
        <BsmButton
            text="login"
            onClick={event => {
                event.stopPropagation();
                openOAuth(OAuthType.Beatleader);
            }}
        />
        <BsmButton
            text="logout"
            onClick={event => {
                event.stopPropagation();
                logoutOAuth(OAuthType.Beatleader);
            }}
        />
    </div>
}
