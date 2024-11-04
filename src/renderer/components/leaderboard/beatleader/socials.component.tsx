import { BsmButton } from "renderer/components/shared/bsm-button.component";
import { BsmLink } from "renderer/components/shared/bsm-link.component";
import { BeatleaderSocial } from "renderer/services/third-parties/beatleader.service";

type Props = {
    externalPlayerUrl?: string;
    socials: BeatleaderSocial[]
}

export function BeatleaderSocials({ externalPlayerUrl, socials }: Readonly<Props>) {
    if (socials.length === 0) {
        return <div className="rounded-b-md bg-light-main-color-1 dark:bg-main-color-1" />
    }

    const filteredSocials = socials.filter(social => !social.hidden && social.service === "Discord");
    return <div className="flex justify-end gap-x-2 p-2 rounded-b-md bg-light-main-color-1 dark:bg-main-color-1">
        {externalPlayerUrl && externalPlayerUrl.includes("steam") &&
            <BsmLink href={externalPlayerUrl}>
                <BsmButton className="w-8 h-8" icon="steam" />
            </BsmLink>
        }

        {filteredSocials.map(social =>
            <BsmLink key={social.id} href={social.link}>
                <BsmButton className="w-8 h-8" icon="discord" />
            </BsmLink>
        )}
    </div>
}

