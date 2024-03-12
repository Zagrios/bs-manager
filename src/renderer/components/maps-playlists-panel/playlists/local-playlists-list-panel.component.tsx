import { forwardRef, useContext, useState } from "react";
import { BsContentLoader } from "renderer/components/shared/bs-content-loader.component";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, finalize, lastValueFrom, map, merge, mergeAll, of, pipe, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { noop } from "shared/helpers/function.helpers";
import { LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistItem } from "./playlist-item.component";
import { useStateMap } from "renderer/hooks/use-state-map.hook";
import { ModalService } from "renderer/services/modale.service";
import { LocalPlaylistDetailsModal } from "renderer/components/modal/modal-types/playlist/local-playlist-details-modal.component";
import { InstalledMapsContext } from "../maps-playlists-panel.component";
import { IpcService } from "renderer/services/ipc.service";
import equal from "fast-deep-equal";
import { useObservable } from "renderer/hooks/use-observable.hook";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export const LocalPlaylistsListPanel = forwardRef<unknown, Props>(({ version, className, isActive, linkedState }, forwardedRef) => {

    const playlistService = useService(PlaylistsManagerService);
    const modals = useService(ModalService);
    const ipc = useService(IpcService);

    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });

    const { maps$, playlists$, setPlaylists } = useContext(InstalledMapsContext);

    const playlists = useObservable(() => playlists$, []);

    const [playlistsLoading, setPlaylistsLoading] = useState(false);
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
            setPlaylists(loadedPlaylists);
        }).catch(() => {
            setPlaylists([]);
        }).finally(() => {
            loadPercent$.next(0);
        });

    }, [isActiveOnce, version, linked]);

    const viewPlaylistFile = (path: string) => {
        return lastValueFrom(ipc.sendV2("view-path-in-explorer", { args: path }));
    };

    const deletePlaylist = (path: string) => {
        // !! Need to call the modal to confirm the deletion and to ask if the maps should be deleted too
        lastValueFrom(playlistService.deletePlaylist({ path, deleteMaps: false })).then(() => {
            setPlaylists(playlists.filter(p => p.path !== path));
        })
    };

    const openPlaylistDetails = (playlistKey: string) => {
        const localPlaylist$ = playlists$.pipe(map(playlists => playlists.find(p => p.path === playlistKey)));
        const installedMaps$ = combineLatest([maps$, localPlaylist$]).pipe(
            filter(([maps, playlist]) => !!maps && !!playlist),
            map(([maps, playlist]) => maps.filter(m => playlist.songs.some(song => song.hash.toLocaleLowerCase() === m.hash.toLocaleLowerCase()))),
            distinctUntilChanged(equal)
        );

        modals.openModal(LocalPlaylistDetailsModal, {
            data: { version, localPlaylist$, installedMaps$ },
            noStyle: true,
        })
    };

    const render = () => {
        if(playlistsLoading){
            return (
                <BsContentLoader className="w-full h-full flex justify-center flex-col items-center" value$={loadPercent$} text="aaaa"/>
            )
        }

        if (playlists?.length){
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
                            onClickDelete={() => deletePlaylist(p.path)}
                            onClickSync={() => console.log("sync")}
                            onClickOpenFile={() => viewPlaylistFile(p.path)}
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
