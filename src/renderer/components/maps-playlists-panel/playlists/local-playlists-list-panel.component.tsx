import { forwardRef, useCallback, useContext, useState } from "react";
import { BsContentLoader } from "renderer/components/shared/bs-content-loader.component";
import { useChangeUntilEqual } from "renderer/hooks/use-change-until-equal.hook";
import { useConstant } from "renderer/hooks/use-constant.hook";
import { useOnUpdate } from "renderer/hooks/use-on-update.hook";
import { useService } from "renderer/hooks/use-service.hook";
import { PlaylistsManagerService } from "renderer/services/playlists-manager.service";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import { BehaviorSubject, combineLatest, distinctUntilChanged, filter, finalize, lastValueFrom, map, tap } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { noop } from "shared/helpers/function.helpers";
import { LocalBPList, LocalBPListsDetails } from "shared/models/playlists/local-playlist.models";
import { PlaylistItem } from "./playlist-item.component";
import { useStateMap } from "renderer/hooks/use-state-map.hook";
import { ModalExitCode, ModalService } from "renderer/services/modale.service";
import { LocalPlaylistDetailsModal } from "renderer/components/modal/modal-types/playlist/playlist-details-modal/local-playlist-details-modal.component";
import { InstalledMapsContext } from "../maps-playlists-panel.component";
import { IpcService } from "renderer/services/ipc.service";
import equal from "fast-deep-equal";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { PlaylistDownloaderService } from "renderer/services/playlist-downloader.service";
import { ProgressBarService } from "renderer/services/progress-bar.service";
import { NotificationService } from "renderer/services/notification.service";
import { DeletePlaylistModal } from "renderer/components/modal/modal-types/playlist/delete-playlist-modal.component";
import { OsDiagnosticService } from "renderer/services/os-diagnostic.service";
import { PlaylistItemComponentPropsMapper } from "shared/mappers/playlist/playlist-item-component-props.mapper";
import { VirtualScroll } from "renderer/components/shared/virtual-scroll/virtual-scroll.component";

type Props = {
    version: BSVersion;
    className?: string;
    linkedState?: FolderLinkState;
    isActive?: boolean;
};

// TODO : Translate

export const LocalPlaylistsListPanel = forwardRef<unknown, Props>(({ version, className, isActive, linkedState }, forwardedRef) => {

    const playlistService = useService(PlaylistsManagerService);
    const playlistDownloader = useService(PlaylistDownloaderService);
    const modals = useService(ModalService);
    const ipc = useService(IpcService);
    const progress = useService(ProgressBarService);
    const osDiagnostic = useService(OsDiagnosticService);
    const notification = useService(NotificationService);

    const isOnline = useObservable(() => osDiagnostic.isOnline$, false);
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

        const onPlaylistDownloadedCB = (downloaded: LocalBPListsDetails) => {
            const newPlaylist = (() => {
                const index = playlists$.value.findIndex(p => p.path === downloaded.path);
                if(index === -1){
                    return [...playlists$.value, downloaded];
                }

                const newPlaylists = [...playlists$.value];
                newPlaylists[index] = downloaded;
                return newPlaylists;
            })();
            setPlaylists(newPlaylist);
        }

        const sub = playlistDownloader.currentDownload$.pipe(filter(download => download?.downloaded && equal(download?.info.version, version))).subscribe(download => onPlaylistDownloadedCB(download.downloaded));

        return () => {
            sub.unsubscribe();
        }

    }, [isActiveOnce, version, linked]);

    const installPlaylist = (playlist: LocalBPList) => {

        const ignoreSongsHashs = (maps$.value || []).map(m => m.hash.toLocaleLowerCase());

        const obs$ = playlistDownloader.downloadPlaylist({ downloadSource: playlist.customData?.syncURL ?? playlist.path, version, ignoreSongsHashs, dest: playlist.path });

        return lastValueFrom(obs$).then(res => {
            if(res.current === res.total){
                notification.notifySuccess({ title: "Playlist synchronisée !", desc: "La playlist et ses maps on été téléchargées.", duration: 5000 })
            }
        });
    }

    const viewPlaylistFile = (path: string) => {
        return lastValueFrom(ipc.sendV2("view-path-in-explorer", path));
    };

    const deletePlaylist = async (bpList: LocalBPList) => {
        const { exitCode, data: deleteMaps } = await modals.openModal(DeletePlaylistModal, { data: bpList });

        if(exitCode !== ModalExitCode.COMPLETED){ return; }

        lastValueFrom(playlistService.deletePlaylist({ version, bpList, deleteMaps })).then(() => {
            setPlaylists(playlists$.value.filter(p => p.path !== bpList.path));
        })
    };

    const openPlaylistDetails = (playlistPath: string) => {
        const localPlaylist$ = playlists$.pipe(map(playlists => playlists.find(p => p.path === playlistPath)));
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

    const renderPlaylist = useCallback((playlist: LocalBPListsDetails) => {
        return (
            <PlaylistItem
                key={playlist.path}
                {...PlaylistItemComponentPropsMapper.fromLocalBPListDetails(playlist)}
                isDownloading$={playlistDownloader.$isPlaylistDownloading(playlist.customData?.syncURL ?? playlist.path, version)}
                isInQueue$={playlistDownloader.$isPlaylistInQueue(playlist.customData?.syncURL ?? playlist.path, version)}
                onClickOpen={() => openPlaylistDetails(playlist.path)}
                onClickDelete={() => deletePlaylist(playlist)}
                onClickSync={isOnline && (() => installPlaylist(playlist))}
                onClickOpenFile={() => viewPlaylistFile(playlist.path)}
                onClickCancelDownload={() => playlistDownloader.cancelDownload(playlist.customData?.syncURL ?? playlist.path, version)}
            />
        );
    }, [isOnline, version]);

    return (
        <div className={className}>
            {(() => {
                if(playlistsLoading){
                    return (
                        <BsContentLoader className="w-full h-full flex justify-center flex-col items-center" value$={loadPercent$} text="aaaa"/>
                    )
                }

                if (playlists?.length){
                    return (
                        <VirtualScroll
                            classNames={{
                                mainDiv: "size-full",
                                rows: "gap-2 px-2 py-2"
                            }}
                            itemHeight={120}
                            maxColumns={4}
                            minItemWidth={390}
                            items={playlists}
                            renderItem={renderPlaylist}
                            rowKey={rowPlaylists => rowPlaylists.map(p => p.path).join("-")}
                        />
                    )
                }

                return <span>TODO</span>;
            })()}
        </div>
    )
});
