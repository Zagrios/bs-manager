import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BSVersion } from "shared/bs-version.interface";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export function LocalPlaylistsListPanel({ version, className, isActive, linkedState }: Props) {
    return (
        <div>local-playlists-list-panel.component</div>
    )
}
