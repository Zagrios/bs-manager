import Tippy from "@tippyjs/react";
import { GlowEffect } from "renderer/components/shared/glow-effect.component";
import { BsmIcon, BsmIconType } from "renderer/components/svgs/bsm-icon.component"
import { useTranslation } from "renderer/hooks/use-translation.hook";

type props = {
    onClick: (active: boolean) => void,
    active: boolean,
    text: string,
    icon: BsmIconType,
    infoText?: string,
}

export function LaunchModToogle({onClick, active, text, icon, infoText}: props) {

    const t = useTranslation();

    return (
        <div className={`relative rounded-full cursor-pointer group active:scale-95 transition-transform ${!active && "shadow-md shadow-black"}`} onClick={() => onClick(!active)}>
            <GlowEffect visible={active} className="absolute !rounded-full blur-[2px]"/>
            <div className='w-full h-full px-6 flex gap-1.5 justify-center items-center bg-light-main-color-2 dark:bg-main-color-2 p-3 rounded-full text-gray-800 dark:text-white group-hover:bg-light-main-color-1 dark:group-hover:bg-main-color-1'>
                <BsmIcon icon={icon} className='h-7 text-gray-800 dark:text-white'/>
                <span className='w-fit min-w-fit text-lg font-bold uppercase tracking-wide italic '>{t(text)}</span>
                {infoText && (
                    <Tippy content={t(infoText)} placement="bottom" delay={[400, 0]}>
                        <div className="h-[25px] w-[25px] p-1.5 rounded-full cursor-help bg-light-main-color-1 dark:bg-main-color-3 hover:brightness-110">
                            <BsmIcon className="w-full h-full" icon="info"/>
                        </div>
                    </Tippy>
                )}
            </div>
        </div>
    )
}
