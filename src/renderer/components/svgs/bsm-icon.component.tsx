import { SettingIcon } from "./setting-icon.component"
import { TrashIcon } from "./trash-icon.component"
import { FavoriteIcon } from "./favorite-icon.component"
import { FolderIcon } from "./folder-icon.component";
import { BsNoteFill } from "./bs-note-fill.component";
import { TerminalIcon } from "./terminal-icon.component";
import { DesktopIcon } from "./desktop-icon.component";
import { OculusIcon } from "./oculus-icon.component";
import { AddIcon } from "./add-icon.component";
import CrossIcon from "./cross-icon.component";
import { FranceIcon } from "./flags/france-icon.component";
import { SpainIcon } from "./flags/spain-icon.component";
import { UsaIcon } from "./flags/usa-icon.component";
import { UkIcon } from "./flags/uk-icon.component";

export type BsmIconType = "settings"|"trash"|"favorite"|"folder"|"bsNote"|"terminal"|"desktop"|"oculus"|"add"|"cross"|"fr-FR-flag"|"es-ES-flag"|"en-US-flag"|"en-EN-flag";

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
        if(icon === "cross"){ return <CrossIcon className={className}/> }
        if(icon === "fr-FR-flag"){ return <FranceIcon className={className}/> }
        if(icon === "es-ES-flag"){ return <SpainIcon className={className}/> }
        if(icon === "en-US-flag"){ return <UsaIcon className={className}/> }
        if(icon === "en-EN-flag"){ return <UkIcon className={className}/> }
    }

  return (
    <>
        {renderIcon()}
    </>
  )
}
