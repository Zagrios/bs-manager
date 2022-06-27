import { SettingIcon } from "./setting-icon.component"
import { TrashIcon } from "./trash-icon.component"
import { FavoriteIcon } from "./favorite-icon.component"
import { FolderIcon } from "./folder-icon.component";
import { BsNoteFill } from "./bs-note-fill.component";
import { TerminalIcon } from "./terminal-icon.component";
import { DesktopIcon } from "./desktop-icon.component";
import { OculusIcon } from "./oculus-icon.component";
import { AddIcon } from "./add-icon.component";

export type BsmIconType = "settings"|"trash"|"favorite"|"folder"|"bsNote"|"terminal"|"desktop"|"oculus"|"add";

export function BsmIcon({className, icon}: {className?: string, icon: BsmIconType}) {

    const renderIcon = () => {
        if(icon === "settings"){ return <SettingIcon className={className}/> }
        if(icon === "trash"){ return <TrashIcon className={className}/> }
        if(icon === "favorite"){ return <FavoriteIcon className={className}/> }
        if(icon === "folder"){ return <FolderIcon className={className}/> }
        if(icon === "bsNote"){ return <BsNoteFill className={className}/> }
        if(icon === "terminal"){ return <TerminalIcon className={className}/> }
        if(icon === "desktop"){ return <DesktopIcon className={className}/> }
        if(icon === "oculus"){ return <OculusIcon className={className}/> }
        if(icon === "add"){ return <AddIcon className={className}/> }
    }

  return (
    <>
        {renderIcon()}
    </>
  )
}
