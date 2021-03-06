import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component"
import OutsideClickHandler from 'react-outside-click-handler';
import React from "react";
import { BsmImage } from "./bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";

type BsmButtonType = "primary"|"success"|"cancel"|"error";

type propsType = {
    className?: string,
    style?: React.CSSProperties,
    imgClassName?: string,
    icon?: BsmIconType,
    image?: string,
    text?: string,
    type?: string,
    active?: boolean,
    withBar?: boolean,
    disabled?: boolean,
    onClickOutside?: (e: MouseEvent) => void,
    onClick?: (e: React.MouseEvent) => void,
    typeColor?:BsmButtonType
}

export function BsmButton({className, style, imgClassName, icon, image, text, type, active, withBar = true, disabled, onClickOutside, onClick, typeColor}: propsType) {

  const t = useTranslation();
  const secondColor = useThemeColor("second-color");

  const primaryColor = typeColor === "primary" ? useThemeColor("first-color") : null;

  const textColor = !primaryColor ? null : (() => {
    const hex = primaryColor.replaceAll("#", "");
    const uicolors = [parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(0, 2), 16) / 255];
    const c = uicolors.map(col => {
        if (col <= 0.03928) { return col / 12.92; }
        return Math.pow((col + 0.055) / 1.055, 2.4);
    });
    const L = (0.2126 * c[0]) + (0.7152 * c[1]) + (0.0722 * c[2]);
    return (L > 0.179) ? "#000" : "fff";
  })();

  const renderTypeColor = (() => {
    if(typeColor === "primary"){ return null; }
    if(!typeColor){ return `bg-light-main-color-2 dark:bg-main-color-2 ${!withBar && "hover:bg-light-main-color-3 dark:hover:bg-main-color-3"}`; }
    if(typeColor === "cancel"){ return "bg-gray-500"; }
    if(typeColor === "error"){ return "bg-red-500"; }
    if(typeColor === "success"){ return "bg-green-500"; }
    return "";
  })()

  return (
    <OutsideClickHandler onOutsideClick={e => onClickOutside && onClickOutside(e)}>
      <div onClick={e => onClick && onClick(e)} className={`${className} overflow-hidden cursor-pointer group ${!withBar && !!typeColor && "hover:brightness-[1.15]"} ${disabled && "brightness-75 cursor-not-allowed"} ${renderTypeColor}`} style={{...style, ...(!!primaryColor && {backgroundColor: primaryColor})}}>
        { image && <BsmImage image={image} className={imgClassName}/> }
        { icon && <BsmIcon icon={icon} className="h-full w-full text-gray-800 dark:text-white"/> }
        {text && (type === "submit" ? <button className="w-full h-full" style={{...(!!textColor && {color: textColor})}}>{t(text)}</button> : <span style={{...(!!textColor && {color: textColor})}} >{t(text)}</span>)}
        { withBar && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-current" style={{color: secondColor}}>
            <div className="absolute top-0 left-0 h-full w-full bg-current brightness-50"/>
            <div className={`absolute top-0 left-0 h-full w-full bg-inherit -translate-x-full group-hover:translate-x-0 transition-transform shadow-center shadow-current ${active && "translate-x-0"}`}/>
          </div>
        )}
      </div>
    </OutsideClickHandler>

  )
}
