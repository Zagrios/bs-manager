import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component"
import OutsideClickHandler from 'react-outside-click-handler';
import React from "react";
import { BsmImage } from "./bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { ConfigurationService } from "renderer/services/configuration.service";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";

type BsmButtonType = "primary"|"success"|"cancel"|"error";

export function BsmButton({className, style, imgClassName, icon, image, text, type, active, withBar = true, disabled, onClickOutside, onClick, typeColor}: {className?: string, style?: React.CSSProperties, imgClassName?: string, icon?: BsmIconType, image?: string, text?: string, type?: string, active?: boolean, withBar?: boolean, disabled?: boolean, onClickOutside?: (e: MouseEvent) => void, onClick?: (e: React.MouseEvent) => void, typeColor?:BsmButtonType}) {

  const configService = ConfigurationService.getInstance();

  const t = useTranslation();
  const secondColor = useObservable(configService.watch("second-color" as DefaultConfigKey));

  return (
    <OutsideClickHandler onOutsideClick={e => onClickOutside && onClickOutside(e)}>
      <div onClick={e => onClick && onClick(e)} className={`${className} overflow-hidden cursor-pointer group ${disabled && "brightness-75 cursor-not-allowed"} ${typeColor === "error" && 'bg-red-500'} ${typeColor == "primary" && 'bg-blue-500'}`} style={style}>
        { image && <BsmImage image={image} className={imgClassName}/> }
        { icon && <BsmIcon icon={icon} className="h-full w-full text-gray-800 dark:text-white"/> }
        {text && (type === "submit" ? <button className="w-full h-full">{t(text)}</button> : <span>{t(text)}</span>)}
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
