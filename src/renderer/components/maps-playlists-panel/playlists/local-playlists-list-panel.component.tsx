import { forwardRef, useState } from "react";
import { BsContentLoader } from "renderer/components/shared/bs-content-loader.component";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BehaviorSubject, finalize, lastValueFrom, map, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { noop } from "shared/helpers/function.helpers";
import { LocalBPList } from "shared/models/playlists/local-playlist.models";
import { PlaylistItem } from "./playlist-item.component";
import { useStateMap } from "renderer/hooks/use-state-map.hook";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

export const LocalPlaylistsListPanel = forwardRef<unknown, Props>(({ version, className, isActive, linkedState }, forwardedRef) => {

    const playlistService = useService(PlaylistsManagerService);

    const isActiveOnce = useChangeUntilEqual(isActive, { untilEqual: true });

    const [playlistsLoading, setPlaylistsLoading] = useState(false);
    const [playlists, setPlaylists] = useState<LocalBPList[]>([]);
    const loadPercent$ = useConstant(() => new BehaviorSubject<number>(0));
    const linked = useStateMap(linkedState, (newState, precMapped) => (newState === FolderLinkState.Pending || newState === FolderLinkState.Processing) ? precMapped : newState === FolderLinkState.Linked, false);

    const loadPlaylists = (): Promise<LocalBPList[]> => {
        setPlaylistsLoading(true);
        const obs = playlistService.getVersionPlaylists(version).pipe(
            tap({ next: load => loadPercent$.next((load.current / load.total) * 100)}),
            map(load => load.data),
            finalize(() => setPlaylistsLoading(false))
        );

        return lastValueFrom(obs);
    }

    const getNbMappersOfPlaylist = (playlist: LocalBPList) => {
        return new Set(playlist.songs.map(s => s.songDetails?.uploader?.id ?? s.song.hash)).size;
    };

    const getDurationOfPlaylist = (playlist: LocalBPList) => {
        return playlist.songs.reduce((acc, s) => acc + (s.songDetails?.duration ?? 0), 0);
    }

    const getMinNpsOfPlaylist = (playlist: LocalBPList) => {
        let min = Infinity;
        playlist.songs.forEach(s => {
            s.songDetails?.difficulties.forEach(d => {
                if(d.nps < min){
                    min = d.nps;
                }
            })
        });
        return min === Infinity ? null : min;
    }

    const getMaxNpsOfPlaylist = (playlist: LocalBPList) => {
        let max = -Infinity;
        playlist.songs.forEach(s => {
            s.songDetails?.difficulties.forEach(d => {
                if(d.nps > max){
                    max = d.nps;
                }
            })
        });
        return max === -Infinity ? null : max;
    }

    useOnUpdate(() => {

        if(!isActiveOnce){ return noop(); }

        loadPlaylists().then(loadedPlaylists => {
            setPlaylists(() => loadedPlaylists);
        }).catch(() => {
            setPlaylists([])
        }).finally(() => {
            loadPercent$.next(0);
        });

    }, [isActiveOnce, version, linked]);

    const render = () => {
        if(playlistsLoading){
            return (
                <BsContentLoader className="w-full h-full flex justify-center flex-col items-center" value$={loadPercent$} text="aaaa"/>
            )
        }

        if (playlists.length){
            return (
                <>
                    <ul className="size-full flex flex-row flex-wrap justify-start content-start p-3 gap-3 overflow-y-scroll">
                        {playlists.map(p =>
                            <PlaylistItem
                                key={p.path}
                                id={p.path}
                                title={p.playlistTitle}
                                author={p.playlistAuthor}
                                coverBase64={p.image}
                                nbMaps={p.songs.length}
                                nbMappers={getNbMappersOfPlaylist(p)}
                                duration={getDurationOfPlaylist(p)}
                                maxNps={getMaxNpsOfPlaylist(p)}
                                minNps={getMinNpsOfPlaylist(p)}
                            />
                        )}
                    </ul>
                    <br/>
                </>
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
