import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component"
import OutsideClickHandler from 'react-outside-click-handler';
import React from "react";
import { BsmImage } from "./bsm-image.component";

export function BsmButton({className, imgClassName, icon, image, text, type, active, withBar = true, onClickOutside, onClick}: {className?: string, imgClassName?: string, icon?: BsmIconType, image?: string, text?: string, type?: string, active?: boolean, withBar?: boolean, onClickOutside?: (e: MouseEvent) => void, onClick?: (e: React.MouseEvent) => void}) {
  return (
    <OutsideClickHandler onOutsideClick={e => onClickOutside && onClickOutside(e)}>
      <div onClick={e => onClick && onClick(e)} className={`${className} overflow-hidden cursor-pointer bg-main-color-2 text-white group`}>
        { image && <BsmImage image={image} className={imgClassName}/> }
        { icon && <BsmIcon icon={icon} className="h-full w-full"/> }
        {text && (type === "submit" ? <button>{text}</button> : <span>{text}</span>)}
        { withBar && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500">
            <div className="absolute top-0 left-0 h-full w-full bg-inherit brightness-50"/>
            <div className={`absolute top-0 left-0 h-full w-full bg-inherit -translate-x-full group-hover:translate-x-0 transition-transform shadow-center shadow-red-500 ${active && "translate-x-0"}`}/>
          </div>
        )}
      </div>
    </OutsideClickHandler>
    
  )
}
