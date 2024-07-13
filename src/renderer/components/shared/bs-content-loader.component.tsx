import { useTranslation } from "renderer/hooks/use-translation.hook";
import TextProgressBar from "../progress-bar/text-progress-bar.component";
import { BsmImage } from "./bsm-image.component";
import BeatWaitingImg from "../../../../assets/images/apngs/beat-waiting.png";
import { Observable } from "rxjs";

type Props = {
    className?: string;
    value$: Observable<number | string>;
    text: string;
}

export function BsContentLoader({className, value$, text}: Props) {

    const t = useTranslation();

    return (
        <div className={className}>
            <BsmImage className="size-32 spin-loading" image={BeatWaitingImg} />
            <span>{t(text)}</span>
            <TextProgressBar value$={value$} />
        </div>
    )
}
