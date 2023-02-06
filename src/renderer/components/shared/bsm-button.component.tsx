import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component"
import { useRef, CSSProperties, MouseEvent } from "react";
import { BsmImage } from "./bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { getCorrectTextColor } from "renderer/helpers/correct-text-color";

type BsmButtonType = "primary"|"success"|"cancel"|"error";

type Props = {
    className?: string,
    style?: CSSProperties,
    imgClassName?: string,
    iconClassName?: string,
    icon?: BsmIconType,
    image?: string,
    text?: string,
    type?: string,
    active?: boolean,
    withBar?: boolean,
    disabled?: boolean,
    onClickOutside?: (e: MouseEvent) => void,
    onClick?: (e: React.MouseEvent) => void,
    typeColor?:BsmButtonType,
    color?: string,
    title?: string,
    iconColor?: string,
    textClassName?: string
}

export function BsmButton({className, style, imgClassName, iconClassName, icon, image, text, type, active, withBar = true, disabled, onClickOutside, onClick, typeColor, color, title, iconColor, textClassName}: Props) {

    const t = useTranslation();
    const secondColor = useThemeColor("second-color");
    const ref = useRef(null);
    useClickOutside(ref, onClickOutside);

    const primaryColor = typeColor === "primary" && useThemeColor("first-color");

    const textColor = (() => {
        if(primaryColor){ return getCorrectTextColor(primaryColor); }
        return typeColor ? "white" : undefined;
    })();

    const renderTypeColor = (() => {
        if(typeColor === "primary"){ return ""; }
        if(!typeColor){ return `bg-light-main-color-2 dark:bg-main-color-2 ${(!withBar && !disabled) && "hover:brightness-125"}`; }
        if(typeColor === "cancel"){ return "bg-gray-500"; }
        if(typeColor === "error"){ return "bg-red-500"; }
        if(typeColor === "success"){ return "bg-green-500"; }
        return "";
    })();

    const handleClick = (e: MouseEvent) => !disabled && onClick(e);

    return (
        <div ref={ref} onClick={handleClick} title={t(title)} className={`${className} overflow-hidden cursor-pointer group ${(!withBar && !disabled && (!!typeColor || !!color)) && "hover:brightness-[1.15]"} ${disabled && "brightness-75 cursor-not-allowed"} ${renderTypeColor}`} style={{...style, backgroundColor: primaryColor || color}}>
            { image && <BsmImage image={image} className={imgClassName}/> }
            { icon && <BsmIcon icon={icon} className={iconClassName ?? "h-full w-full text-gray-800 dark:text-white"} style={{color: iconColor}}/> }
            {text && (type === "submit" ? <button type="submit" className={textClassName || "h-full w-full"} style={{...(!!textColor && {color: textColor})}}>{t(text)}</button> : <span className={textClassName} style={{...(!!textColor && {color: `${textColor}`})}}>{t(text)}</span>)}
            { withBar && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-current" style={{color: secondColor}}>
                    <div className="absolute top-0 left-0 h-full w-full bg-current brightness-50"/>
                    <div className={`absolute top-0 left-0 h-full w-full bg-inherit -translate-x-full group-hover:translate-x-0 transition-transform shadow-center shadow-current ${active && "translate-x-0"}`}/>
                </div>
            )}
        </div>
    )
}
