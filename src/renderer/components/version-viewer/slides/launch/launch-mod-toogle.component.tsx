import { BsmIcon, BsmIconType } from "renderer/components/svgs/bsm-icon.component"
import { useTranslation } from "renderer/hooks/use-translation.hook";

type props = {onClick: (active: boolean) => void, active: boolean, text: string, icon: BsmIconType}

export function LaunchModToogle({onClick, active, text, icon}: props) {

    const t = useTranslation();

    return (
        <div className={`relative rounded-full cursor-pointer group active:scale-95 transition-transform ${!active && "shadow-md shadow-black"}`} onClick={() => onClick(!active)}>
            <div className={`absolute glow-on-hover rounded-full ${active && "opacity-100 blur-[2px]"}`}/>
            <div className='w-full h-full pl-6 pr-6 flex justify-center items-center bg-light-main-color-2 dark:bg-main-color-2 p-3 rounded-full text-gray-800 dark:text-white group-hover:bg-light-main-color-1 dark:group-hover:bg-main-color-1'>
                <BsmIcon icon={icon} className='mr-1 h-7 text-gray-800 dark:text-white'/>
                <span className='w-fit min-w-fit h-full text-lg font-bold uppercase tracking-wide italic'>{t(text)}</span>
            </div>
        </div>
    )
}
