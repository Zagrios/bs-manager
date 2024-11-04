import { noop } from "shared/helpers/function.helpers";
import { defaultAuthService } from "renderer/services";
import { BsmButton } from "../shared/bsm-button.component";
import { OAuthType } from "shared/models/oauth.types";
import { ReactNode, useState } from "react";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { defaultBeatleaderAPIClientService } from "renderer/services/third-parties";
import { BeatleaderPlayerInfo } from "renderer/services/third-parties/beatleader.service";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { BeatleaderHeaderSection } from "./beatleader/header-section.component";
import { BeatleaderStatsSection } from "./beatleader/stats-section.component";
import BeatConflictImg from "../../../../assets/images/apngs/beat-conflict.png";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png";


type Props = {
    isActive: boolean;
}

export function LeaderboardPanel({ isActive }: Readonly<Props>) {
    const osService = useService(OsDiagnosticService);

    const online = useObservable(() => osService.isOnline$);

    const authService = defaultAuthService();
    const beatleaderService = defaultBeatleaderAPIClientService();
    const [authenticated, setAuthenticated] = useState(beatleaderService.isAuthenticated());
    const [playerInfo, setPlayerInfo] = useState(null as BeatleaderPlayerInfo | null);
    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });

    useOnUpdate(() => {
        if (!isActiveOnce) {
            return noop;
        }

        // Listen to storage changes since rjsx observers aren't visible to another window
        // NOTE: Might need a service or something
        window.onstorage = (event) => {
            if (event.key === OAuthType.Beatleader) {
                setAuthenticated(beatleaderService.isAuthenticated());
            }
        };

        if (online && authenticated) {
            beatleaderService.getCurrentPlayerInfo()
                .then(setPlayerInfo);
        }

        return () => {
            window.onstorage = null;
        };
    }, [isActiveOnce, online, authenticated]);

    if (!authenticated) {
        return <BsmButton
            text="Login to BeatLeader"
            textClassName="rounded-md p-2 bg-light-main-color-1 dark:bg-main-color-1"
            onClick={event => {
                event.stopPropagation();
                authService.openOAuth(OAuthType.Beatleader);
            }}
        />
    }

    if (!online) {
        return <div className="flex flex-col gap-y-8 w-full h-full rounded-md bg-light-main-color-2 dark:bg-main-color-2">
            <LeaderboardStatus
                text="No internet"
                image={BeatConflictImg}
            />
        </div>
    }

    if (!playerInfo) {
        return <div className="flex flex-col gap-y-8 w-full h-full rounded-md bg-light-main-color-2 dark:bg-main-color-2">
            <LeaderboardStatus
                text="Getting player information..."
                image={BeatWaitingImg}
                spin
            />
        </div>
    }

    return <div className="flex flex-col gap-y-8 w-full h-full">
        <BeatleaderHeaderSection
            playerInfo={playerInfo}
            onLogoutClicked={() => {
                authService.logoutOAuth(OAuthType.Beatleader);
                setAuthenticated(false);
                setPlayerInfo(null);
            }}
        />

        <BeatleaderStatsSection playerInfo={playerInfo} />
    </div>
}

function LeaderboardStatus({ text, image, spin = false, children }: Readonly<{
    text: string;
    image: string;
    spin?: boolean,
    children?: ReactNode
}>) {
    const t = useTranslation();

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-800 dark:text-gray-200">
            <img className={`w-32 h-32 ${spin ? "spin-loading" : ""}`} src={image} alt=" " />
            <span className="text-xl mt-3 italic">{t(text)}</span>
            {children}
        </div>
    );
}
