import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom"
import { logRenderError } from "renderer";
import { defaultBeatleaderAuthClientService } from "renderer/services/auth";
import { OAuthType } from "shared/models/oauth.types";

const OAUTH_HANDLER = {
    [OAuthType.Beatleader]: defaultBeatleaderAuthClientService,
};

function useAuthentication(type: OAuthType, code: string) {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const handler = OAUTH_HANDLER[type];
        if (!handler) {
            logRenderError("OAuth failed", `Received state/type: "${type}"`);
            setLoading(false);
            return;
        }

        handler().verifyCode(code)
            .then(() => {
                setAuthenticated(true);
            })
            .catch(error => {
                logRenderError("OAuth failed", error);
                setAuthenticated(false);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return { loading, authenticated };
}

export default function OAuthWindow() {
    const [searchParams,] = useSearchParams();
    const { loading, authenticated } = useAuthentication(
        searchParams.get("state") as OAuthType,
        searchParams.get("code")
    );

    // TODO: UI
    if (loading) {
        return <div>
            TODO: Spinner
        </div>
    }

    return <div>
        {authenticated ?
            <div>TODO: Authenticated</div>
            :
            <div>TODO: Could not authentcate</div>
        }
    </div>
}
