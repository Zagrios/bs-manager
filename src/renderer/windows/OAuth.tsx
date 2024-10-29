import { ReactNode, useEffect, useState } from "react";
import { logRenderError } from "renderer";
import { useSearchParams } from "react-router-dom"
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useWindowControls } from "renderer/hooks/use-window-controls.hook";
import { defaultBeatleaderAPIClientService } from "renderer/services/third-parties";
import { OAuthType } from "shared/models/oauth.types";
import { BsmButton } from "renderer/components/shared/bsm-button.component";
import BeatRunningImg from "../../../assets/images/apngs/beat-running.png";
import BeatConflictImg from "../../../assets/images/apngs/beat-conflict.png";
import BeatWaitingImg from "../../../assets/images/apngs/beat-waiting.png";

const OAUTH_HANDLER = {
    [OAuthType.Beatleader]: defaultBeatleaderAPIClientService,
};

function useAuthentication(type: OAuthType, code: string) {
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const handler = OAUTH_HANDLER[type];
        if (!handler) {
            const errorMessage = `Received state/type: "${type}"`;
            setErrorMessage(errorMessage)
            logRenderError("OAuth failed", errorMessage);
            return setLoading(false);
        }

        handler().verifyCode(code)
            .then(() => {
                setAuthenticated(true);
            })
            .catch((error: Error) => {
                setErrorMessage(error.message);
                logRenderError("OAuth failed", error);
                setAuthenticated(false);
            })
            .finally(() => {
                setLoading(false);
            });
    }, []);

    return { loading, authenticated, errorMessage };
}

export default function OAuthWindow() {
    const { close: closeWindow } = useWindowControls();

    const [searchParams,] = useSearchParams();
    const { loading, authenticated, errorMessage } = useAuthentication(
        searchParams.get("state") as OAuthType,
        searchParams.get("code")
    );

    if (loading) {
        return <div className="w-full h-screen">
            <OAuthStatus
                text="Authenticating..."
                image={BeatWaitingImg}
                spin
            />
        </div>
    }

    return <div className="w-full h-screen">
        <OAuthStatus
            text={authenticated ? "Authenticated" : `Could not authenticate. Reason: ${errorMessage}`}
            image={authenticated ? BeatRunningImg : BeatConflictImg}
        >
            <BsmButton
                className="font-bold rounded-md p-2"
                text="Close Window"
                typeColor="secondary"
                withBar={false}
                onClick={event => {
                    event.preventDefault();
                    closeWindow();
                }}
            />
        </OAuthStatus>
    </div>
}

function OAuthStatus({ text, image, spin = false, children }: {
    text: string;
    image: string;
    spin?: boolean,
    children?: ReactNode
}) {
    const t = useTranslation();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-200">
            <img className={`w-32 h-32 ${spin ? "spin-loading" : ""}`} src={image} alt=" " />
            <span className="text-xl my-3 italic">{t(text)}</span>
            {children}
        </div>
    );
}
