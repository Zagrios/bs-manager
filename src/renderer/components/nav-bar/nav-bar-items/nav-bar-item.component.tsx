import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmButton } from "../../shared/bsm-button.component";

type Props = {
    children: JSX.Element,
    isDownloading?: boolean
    progress?: number,
    isActive?: boolean,
    onCancel?: (e: React.MouseEvent) => void
}

export function NavBarItem({progress, isDownloading, children, isActive, onCancel}: Props) {

    const {firstColor, secondColor} = useThemeColor();

    return (
        <li className={`outline-none relative p-[1px] overflow-hidden rounded-xl flex justify-center items-center mb-1 ${isDownloading && "nav-item-download"} active:translate-y-[1px]`}>
            {isDownloading && <div className="download-progress absolute top-0 w-full h-full" style={{transform: `translate(${-(100 - progress)}%, 0)`, background: `linear-gradient(90deg, ${firstColor}, ${secondColor}, ${firstColor}, ${secondColor})`}}/>}
            <div className={`wrapper z-[1] px-1 py-[3px] w-full rounded-xl ${isDownloading && 'bg-white dark:bg-black'} ${!isDownloading && "hover:bg-light-main-color-3 dark:hover:bg-main-color-3"} ${(isActive && !isDownloading) && "bg-light-main-color-3 dark:bg-main-color-3"}`}>
                {children}
                {isDownloading && <BsmButton onClick={onCancel} className="my-1 text-xs text-white rounded-md text-center" withBar={false} text="misc.cancel" typeColor="error"/>}
            </div>
        </li>
    )
}
