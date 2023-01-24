import { useTranslation } from "renderer/hooks/use-translation.hook";
import { Supporter } from "shared/models/supporters";
import { SupporterItem } from "./supporter-item.component";

interface Props {className?: string, title: string, supporters: Supporter[]}

export function SupportersBlock({className, title, supporters}: Props) {

    const t = useTranslation();

    const someDelay = () => {
        const [min, max] = [0, .55]
        const baseDelay = .15;
        return baseDelay + Math.random() * (max - min) + min;
    }

    return (
        <div className={`mb-10 flex flex-col items-center ${className}`}>
            <h2 className="uppercase text-3xl font-bold">{t(title)}</h2>
            <div className="flex justify-center flex-wrap py-5 px-20">
                {supporters.map(s => <SupporterItem key={crypto.randomUUID()} supporter={s} delay={someDelay()}/>)}
            </div>
        </div>
  )
}
