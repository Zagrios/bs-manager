import { SettingIcon } from "./icons/setting-icon.component"
import { TrashIcon } from "./icons/trash-icon.component"
import { FavoriteIcon } from "./icons/favorite-icon.component"
import { FolderIcon } from "./icons/folder-icon.component";
import { BsNoteFill } from "./icons/bs-note-fill.component";
import { TerminalIcon } from "./icons/terminal-icon.component";
import { DesktopIcon } from "./icons/desktop-icon.component";
import { OculusIcon } from "./icons/oculus-icon.component";
import { AddIcon } from "./icons/add-icon.component";
import CrossIcon from "./icons/cross-icon.component";
import { FranceIcon } from "./flags/france-icon.component";
import { SpainIcon } from "./flags/spain-icon.component";
import { UsaIcon } from "./flags/usa-icon.component";
import { UkIcon } from "./flags/uk-icon.component";
import { TaskIcon } from "./icons/task-icon.component";
import { CopyIcon } from "./icons/copy-icon.component";
import { SteamIcon } from "./icons/steam-icon.component";

export type BsmIconType = (
   "settings"|"trash"|"favorite"|"folder"|"bsNote"|
   "terminal"|"desktop"|"oculus"|"add"|"cross"|"task"|
   "copy"|"steam"|
   "fr-FR-flag"|"es-ES-flag"|"en-US-flag"|"en-EN-flag"
);

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
        if(icon === "task"){ return <TaskIcon className={className}/> }
        if(icon === "copy"){ return <CopyIcon className={className}/> }
        if(icon === "steam"){ return <SteamIcon className={className}/> }
        return <TrashIcon className={className}/>
    }

  return (
    <>
        {renderIcon()}
    </>
  )
}
