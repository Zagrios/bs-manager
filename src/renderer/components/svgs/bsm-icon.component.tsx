import { SettingIcon } from "./icons/setting-icon.component";
import { TrashIcon } from "./icons/trash-icon.component";
import { FavoriteIcon } from "./icons/favorite-icon.component";
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
import { CheckIcon } from "./icons/check-icon.component";
import { ThreeDotsIcon } from "./icons/three-dots-icon.component";
import { GitHubIcon } from "./icons/github-icon.component";
import { CloseIcon } from "./icons/close-icon.component";
import { BsMapDifficultyIcon } from "./icons/bs-map-difficulty-icon.component";
import { TwitchIcon } from "./icons/twitch-icon.component";
import EyeIcon from "./icons/eye-icon.component";
import { PlayIcon } from "./icons/play-icon.component";
import { ThumbUpFillIcon } from "./icons/thumb-up-fill-icon.component";
import { TimerFillIcon } from "./icons/timer-fill.component";
import { CheckCircleIcon } from "./icons/check-circle-icon.component";
import { PauseIcon } from "./icons/pause-icon.component";
import { LightshowIcon } from "./icons/lightshow-icon.component";
import { LawlessIcon } from "./icons/lawless-icon.component";
import { NoArrowIcon } from "./icons/no-arrow-icon.component";
import { OneSaberIcon } from "./icons/one-saber-icon.component";
import { NinetyDregreeIcon } from "./icons/ninety-dregree-icon.component";
import { ThreeSixtyDegreeIcon } from "./icons/three-sixty-degree-icon.component";
import { LinkIcon } from "./icons/link-icon.component";
import { UnlinkIcon } from "./icons/unlink-icon.component";
import { DownloadIcon } from "./icons/download-icon.component";
import { FilterIcon } from "./icons/filter-icon.component";
import DiscordIcon from "./icons/discord-icon.component";
import { TwitterIcon } from "./icons/twitter-icon.component";
import { Mee6Icon } from "./icons/mee6-icon.component";
import { InfoIcon } from "./icons/info-icon.component";
import { SyncIcon } from "./icons/sync-icon.component";
import { VolumeUpIcon } from "./icons/volume-up-icon.component";
import { VolumeOffIcon } from "./icons/volume-off-icon.component";
import { VolumeDownIcon } from "./icons/volume-down-icon.component";
import { GermanIcon } from "./flags/german-icon.component";
import { RussianIcon } from "./flags/russian-icon.component";
import { ChineseIcon } from "./flags/chinese-icon.component";
import { ChineseTraditionalIcon } from "./flags/chineseTraditional-icon.component";
import { JapanIcon } from "./flags/japan-icon.component";
import { ChevronTopIcon } from "./icons/chevron-top-icon.component";
import { EyeCrossIcon } from "./icons/eye-cross-icon.component";
import { ShortcutIcon } from "./icons/shortcut-icon.component";
import { BackupRestoreIcon } from "./icons/backup-restore-icon.component";
import { SongDetailDiffCharactertistic } from "shared/models/maps/song-details-cache/song-details-cache.model";

export type BsmIconType = SongDetailDiffCharactertistic | ("settings" | "trash" | "favorite" | "folder" | "bsNote" | "check" | "three-dots" | "twitch" | "eye" | "play" | "checkCircleIcon" | "discord" | "info" | "eye-cross" | "terminal" | "desktop" | "oculus" | "add" | "cross" | "task" | "github" | "close" | "thumbUpFill" | "timerFill" | "pause" | "twitter" | "sync" | "chevron-top" | "copy" | "steam" | "edit" | "export" | "patreon" | "search" | "bsMapDifficulty" | "link" | "unlink" | "download" | "filter" | "mee6" | "volume-up" | "volume-off" | "volume-down" | "shortcut" | "backup-restore" | "fr-FR-flag" | "es-ES-flag" | "en-US-flag" | "en-EN-flag" | "de-DE-flag" | "ru-RU-flag" | "zh-CN-flag" | "zh-TW-flag" | "ja-JP-flag");

export const BsmIcon = memo(({ className, icon, style }: { className?: string; icon: BsmIconType; style?: CSSProperties }) => {
    // TODO : Very ugly very messy, need to find a better way to do this
    // the rework have started, see `svg-icon.type.ts`

    const renderIcon = () => {
        if (icon === "settings") {
            return <SettingIcon className={className} style={style} />;
        }
        if (icon === "trash") {
            return <TrashIcon className={className} style={style} />;
        }
        if (icon === "favorite") {
            return <FavoriteIcon className={className} style={style} />;
        }
        if (icon === "folder") {
            return <FolderIcon className={className} style={style} />;
        }
        if (icon === "bsNote") {
            return <BsNoteFill className={className} style={style} />;
        }
        if (icon === "terminal") {
            return <TerminalIcon className={className} style={style} />;
        }
        if (icon === "desktop") {
            return <DesktopIcon className={className} style={style} />;
        }
        if (icon === "oculus") {
            return <OculusIcon className={className} style={style} />;
        }
        if (icon === "add") {
            return <AddIcon className={className} style={style} />;
        }
        if (icon === "cross") {
            return <CrossIcon className={className} style={style} />;
        }
        if (icon === "fr-FR-flag") {
            return <FranceIcon className={className} style={style} />;
        }
        if (icon === "es-ES-flag") {
            return <SpainIcon className={className} style={style} />;
        }
        if (icon === "en-US-flag") {
            return <UsaIcon className={className} style={style} />;
        }
        if (icon === "en-EN-flag") {
            return <UkIcon className={className} style={style} />;
        }
        if (icon === "de-DE-flag") {
            return <GermanIcon className={className} style={style} />;
        }
        if (icon === "ru-RU-flag") {
            return <RussianIcon className={className} style={style} />;
        }
        if (icon === "zh-CN-flag") {
            return <ChineseIcon className={className} style={style} />;
        }
        if (icon === "zh-TW-flag") {
            return <ChineseTraditionalIcon className={className} style={style} />;
        }
        if (icon === "ja-JP-flag") {
            return <JapanIcon className={className} style={style} />;
        }
        if (icon === "task") {
            return <TaskIcon className={className} style={style} />;
        }
        if (icon === "copy") {
            return <CopyIcon className={className} style={style} />;
        }
        if (icon === "steam") {
            return <SteamIcon className={className} style={style} />;
        }
        if (icon === "edit") {
            return <EditIcon className={className} style={style} />;
        }
        if (icon === "export") {
            return <ExportIcon className={className} style={style} />;
        }
        if (icon === "patreon") {
            return <PatreonIcon className={className} style={style} />;
        }
        if (icon === "search") {
            return <SearchIcon className={className} style={style} />;
        }
        if (icon === "check") {
            return <CheckIcon className={className} style={style} />;
        }
        if (icon === "three-dots") {
            return <ThreeDotsIcon className={className} style={style} />;
        }
        if (icon === "github") {
            return <GitHubIcon className={className} style={style} />;
        }
        if (icon === "close") {
            return <CloseIcon className={className} style={style} />;
        }
        if (icon === "bsMapDifficulty" || icon === "Standard") {
            return <BsMapDifficultyIcon className={className} style={style} />;
        }
        if (icon === "twitch") {
            return <TwitchIcon className={className} style={style} />;
        }
        if (icon === "eye") {
            return <EyeIcon className={className} style={style} />;
        }
        if (icon === "play") {
            return <PlayIcon className={className} style={style} />;
        }
        if (icon === "thumbUpFill") {
            return <ThumbUpFillIcon className={className} style={style} />;
        }
        if (icon === "timerFill") {
            return <TimerFillIcon className={className} style={style} />;
        }
        if (icon === "checkCircleIcon") {
            return <CheckCircleIcon className={className} style={style} />;
        }
        if (icon === "pause") {
            return <PauseIcon className={className} style={style} />;
        }
        if (icon === "Lawless") {
            return <LawlessIcon className={className} style={style} />;
        }
        if (icon === "NoArrows") {
            return <NoArrowIcon className={className} style={style} />;
        }
        if (icon === "OneSaber") {
            return <OneSaberIcon className={className} style={style} />;
        }
        if (icon === "Lightshow") {
            return <LightshowIcon className={className} style={style} />;
        }
        if (icon === "90Degree") {
            return <NinetyDregreeIcon className={className} style={style} />;
        }
        if (icon === "360Degree") {
            return <ThreeSixtyDegreeIcon className={className} style={style} />;
        }
        if (icon === "link") {
            return <LinkIcon className={className} style={style} />;
        }
        if (icon === "unlink") {
            return <UnlinkIcon className={className} style={style} />;
        }
        if (icon === "download") {
            return <DownloadIcon className={className} style={style} />;
        }
        if (icon === "filter") {
            return <FilterIcon className={className} style={style} />;
        }
        if (icon === "discord") {
            return <DiscordIcon className={className} style={style} />;
        }
        if (icon === "twitter") {
            return <TwitterIcon className={className} style={style} />;
        }
        if (icon === "mee6") {
            return <Mee6Icon className={className} style={style} />;
        }
        if (icon === "info") {
            return <InfoIcon className={className} style={style} />;
        }
        if (icon === "sync") {
            return <SyncIcon className={className} style={style} />;
        }
        if (icon === "volume-up") {
            return <VolumeUpIcon className={className} style={style} />;
        }
        if (icon === "volume-down") {
            return <VolumeDownIcon className={className} style={style} />;
        }
        if (icon === "volume-off") {
            return <VolumeOffIcon className={className} style={style} />;
        }
        if (icon === "chevron-top") {
            return <ChevronTopIcon className={className} style={style} />;
        }
        if (icon === "eye-cross") {
            return <EyeCrossIcon className={className} style={style} />;
        }

        if (icon === "shortcut") {
            return <ShortcutIcon className={className} style={style} />;
        }

        if (icon === "backup-restore") {
            return <BackupRestoreIcon className={className} style={style} />;
        }
        return <TrashIcon className={className} style={style} />;
    };

    return <>{renderIcon()}</>;
});
