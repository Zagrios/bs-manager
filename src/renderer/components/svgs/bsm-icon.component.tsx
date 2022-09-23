import { SettingIcon } from "./icons/setting-icon.component"
import { TrashIcon } from "./icons/trash-icon.component"
import { FavoriteIcon } from "./icons/favorite-icon.component"
import { FolderIcon } from "./icons/folder-icon.component";
import { BsNoteFill } from "./icons/bs-note-fill.component";
import { TerminalIcon } from "./icons/terminal-icon.component";
import { DesktopIcon } from "./icons/desktop-icon.component";
import { OculusIcon } from "./icons/oculus-icon.component";
import { AddIcon } from "./icons/add-icon.component";
import { CrossIcon } from "./icons/cross-icon.component";
import { FranceIcon } from "./flags/france-icon.component";
import { SpainIcon } from "./flags/spain-icon.component";
import { UsaIcon } from "./flags/usa-icon.component";
import { UkIcon } from "./flags/uk-icon.component";
import { TaskIcon } from "./icons/task-icon.component";
import { CopyIcon } from "./icons/copy-icon.component";
import { SteamIcon } from "./icons/steam-icon.component";
import { CSSProperties, memo } from "react";
import EditIcon from "./icons/edit-icon.component";
import { ExportIcon } from "./icons/export-icon.component";
import PatreonIcon from "./icons/patreon-icon.component";
import { SearchIcon } from "./icons/search-icon.component";

export type BsmIconType = (
   "settings"|"trash"|"favorite"|"folder"|"bsNote"|
   "terminal"|"desktop"|"oculus"|"add"|"cross"|"task"|
   "copy"|"steam"|"edit"|"export"|"patreon"|"search"|
   "fr-FR-flag"|"es-ES-flag"|"en-US-flag"|"en-EN-flag"
);

export const BsmIcon = memo(({className, icon, style}: {className?: string, icon: BsmIconType, style?: CSSProperties}) => {

    const renderIcon = () => {
        if(icon === "settings"){ return <SettingIcon className={className} style={style}/> }
        if(icon === "trash"){ return <TrashIcon className={className} style={style}/> }
        if(icon === "favorite"){ return <FavoriteIcon className={className} style={style}/> }
        if(icon === "folder"){ return <FolderIcon className={className} style={style}/> }
        if(icon === "bsNote"){ return <BsNoteFill className={className} style={style}/> }
        if(icon === "terminal"){ return <TerminalIcon className={className} style={style}/> }
        if(icon === "desktop"){ return <DesktopIcon className={className} style={style}/> }
        if(icon === "oculus"){ return <OculusIcon className={className} style={style}/> }
        if(icon === "add"){ return <AddIcon className={className} style={style}/> }
        if(icon === "cross"){ return <CrossIcon className={className} style={style}/> }
        if(icon === "fr-FR-flag"){ return <FranceIcon className={className} style={style}/> }
        if(icon === "es-ES-flag"){ return <SpainIcon className={className} style={style}/> }
        if(icon === "en-US-flag"){ return <UsaIcon className={className} style={style}/> }
        if(icon === "en-EN-flag"){ return <UkIcon className={className} style={style}/> }
        if(icon === "task"){ return <TaskIcon className={className} style={style}/> }
        if(icon === "copy"){ return <CopyIcon className={className} style={style}/> }
        if(icon === "steam"){ return <SteamIcon className={className} style={style}/> }
        if(icon === "edit"){ return <EditIcon className={className} style={style}/> }
        if(icon === "export"){ return <ExportIcon className={className} style={style}/> }
        if(icon === "patreon"){ return <PatreonIcon className={className} style={style}/> }
        if(icon === "search"){ return <SearchIcon className={className} style={style}/> }
        return <TrashIcon className={className} style={style}/>
    }

  return (
    <>
        {renderIcon()}
    </>
  )
})
