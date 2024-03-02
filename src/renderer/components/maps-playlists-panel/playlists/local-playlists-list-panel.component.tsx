import { forwardRef, useContext, useState } from "react";
import { BsContentLoader } from "renderer/components/shared/bs-content-loader.component";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BehaviorSubject, finalize, lastValueFrom, map, of, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { noop } from "shared/helpers/function.helpers";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistItem } from "./playlist-item.component";
import { useStateMap } from "renderer/hooks/use-state-map.hook";
import { ModalService } from "renderer/services/modale.service";
import { LocalPlaylistDetailsModal } from "renderer/components/modal/modal-types/playlist/local-playlist-details-modal.component";
import { InstalledMapsContext } from "../maps-playlists-panel.component";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export const LocalPlaylistsListPanel = forwardRef<unknown, Props>(({ version, className, isActive, linkedState }, forwardedRef) => {

    const playlistService = useService(PlaylistsManagerService);
    const modals = useService(ModalService);

    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });

    const { maps$ } = useContext(InstalledMapsContext);
    const [playlistsLoading, setPlaylistsLoading] = useState(false);
    const [playlists, setPlaylists] = useState<LocalBPListsDetails[]>([]);
    const loadPercent$ = useConstant(() => new BehaviorSubject<number>(0));
    const linked = useStateMap(linkedState, (newState, precMapped) => (newState === FolderLinkState.Pending || newState === FolderLinkState.Processing) ? precMapped : newState === FolderLinkState.Linked, false);

    const loadLocalPlaylistsDetails = (): Promise<LocalBPListsDetails[]> => {
        setPlaylistsLoading(true);
        const obs = playlistService.getVersionPlaylistsDetails(version).pipe(
            tap({ next: load => loadPercent$.next((load.current / load.total) * 100)}),
            map(load => load.data),
            finalize(() => setPlaylistsLoading(false))
        );

        return lastValueFrom(obs);
    }

    useOnUpdate(() => {

        if(!isActiveOnce){ return noop(); }

        loadLocalPlaylistsDetails().then(loadedPlaylists => {
            setPlaylists(() => loadedPlaylists);
        }).catch(() => {
            setPlaylists([]);
        }).finally(() => {
            loadPercent$.next(0);
        });

    }, [isActiveOnce, version, linked]);

    console.log(maps$.value);

    const openPlaylistDetails = (playlistKey: string) => {
        const playlist = playlists.find(p => p.path === playlistKey);

        console.log(playlist.songs);

        modals.openModal(LocalPlaylistDetailsModal, {
            data: {
                version,
                title: playlist.playlistTitle,
                image: playlist.image,
                author: playlist.playlistAuthor,
                description: playlist.playlistDescription,
                nbMaps: playlist.nbMaps,
                duration: playlist.duration,
                maxNps: playlist.maxNps,
                minNps: playlist.minNps,
                nbMappers: playlist.nbMappers,
                installedMaps$: maps$.pipe(map(maps => maps.filter(m => playlist.songs.some(song => song.hash.toLocaleLowerCase() === m.hash.toLocaleLowerCase())))),
            },
            noStyle: true,
        })
    };

    const render = () => {
        if(playlistsLoading){
            return (
                <BsContentLoader className="w-full h-full flex justify-center flex-col items-center" value$={loadPercent$} text="aaaa"/>
            )
        }

        if (playlists.length){
            return (
                <ul className="relative size-full flex flex-row flex-wrap justify-start content-start p-3 gap-3">
                    {playlists.map(p =>
                        <PlaylistItem
                            key={p.path}
                            title={p.playlistTitle}
                            author={p.playlistAuthor}
                            coverBase64={p.image}
                            nbMaps={p.nbMaps}
                            nbMappers={p.nbMappers}
                            duration={p.duration}
                            maxNps={p.maxNps}
                            minNps={p.minNps}
                            onClickOpen={() => openPlaylistDetails(p.path)}
                        />
                    )}
                </ul>
            )
        }

        return null;
    }

    return (
        <div className={className}>
            {render()}
        </div>
    )
});
