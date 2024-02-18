import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BSVersion } from "shared/bs-version.interface";
import { noop } from "shared/helpers/function.helpers";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export function LocalPlaylistsListPanel({ version, className, isActive, linkedState }: Props) {

    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });

    useOnUpdate(() => {

        if(!isActiveOnce){ return noop(); }

        // load playlists

    }, [isActiveOnce]);

    return (
        <div>local-playlists-list-panel.component</div>
    )
}
