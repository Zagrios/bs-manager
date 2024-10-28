import { BeatleaderPlayerInfo } from "renderer/services/third-parties/beatleader.service";
import { BeatleaderSocials } from "./socials.component";
import { BsmImage } from "renderer/components/shared/bsm-image.component";
import { BsmButton } from "renderer/components/shared/bsm-button.component";

type Props = {
    playerInfo: BeatleaderPlayerInfo;
    onLogoutClicked?: () => void;
}

// NOTE: Can add the bg image from beatleader
export function BeatleaderHeaderSection({
    playerInfo,
    onLogoutClicked
}: Props) {
    return <div className="w-full rounded-md pt-4 bg-light-main-color-2 dark:bg-main-color-2">
        <div className="flex flex-row justify-between px-4 pb-4">
            <div className="flex flex-row items-center gap-x-4">
                <BsmImage
                    className="w-32 h-32 aspect-square rounded-full"
                    image={playerInfo.avatar}
                />
                <div className="text-4xl font-semibold">
                    {playerInfo.name}
                </div>
            </div>

            <div>
                <BsmButton
                    text="Logout"
                    textClassName="rounded-md p-2 bg-light-main-color-1 dark:bg-main-color-1"
                    onClick={event => {
                        event.stopPropagation();
                        onLogoutClicked?.();
                    }}
                />
            </div>
        </div>

        <BeatleaderSocials
            externalPlayerUrl={playerInfo.externalProfileUrl}
            socials={playerInfo.socials}
        />
    </div>

}
