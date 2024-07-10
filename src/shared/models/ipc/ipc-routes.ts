import { Progression } from "main/helpers/fs.helpers";
import { Observable } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BSLaunchEventData, LaunchOption } from "shared/models/bs-launch";
import { BsvMapDetail, SongDetails } from "shared/models/maps";
import { BsmLocalMap, BsmLocalMapsProgress, DeleteMapsProgress } from "shared/models/maps/bsm-local-map.interface";
import { BsvPlaylist, BsvPlaylistPage, PlaylistSearchParams, SearchParams } from "../maps/beat-saver.model";
import { ImportVersionOptions } from "main/services/bs-local-version.service";
import { DownloadInfo, DownloadSteamInfo } from "main/services/bs-version-download/bs-steam-downloader.service";
import { DepotDownloaderEvent } from "../bs-version-download/depot-downloader.model";
import { MSGetQuery, MSModel, MSModelType } from "../models/model-saber.model";
import { ModelDownload } from "renderer/services/models-management/models-downloader.service";
import { BsmLocalModel } from "../models/bsm-local-model.interface";
import { InstallModsResult, Mod, UninstallModsResult } from "../mods";
import { BPList, DownloadPlaylistProgressionData } from "../playlists/playlist.interface";
import { VersionLinkerAction } from "renderer/services/version-folder-linker.service";
import { FileFilter, OpenDialogReturnValue } from "electron";
import { SystemNotificationOptions } from "../notification/system-notification.model";
import { Supporter } from "../supporters";
import { AppWindow } from "../window-manager/app-window.model";
import { LocalBPList, LocalBPListsDetails } from "../playlists/local-playlist.models";

export type IpcReplier<T> = (data: Observable<T>) => void;

export interface IpcChannelMapping {

    /* ** bs-download-ipcs ** */
    "import-version": { request: ImportVersionOptions, response: Progression<BSVersion>};
    "bs-download.installation-folder": { request: void, response: string};
    "bs-download.set-installation-folder": { request: string, response: string};
    "auto-download-bs-version": { request: DownloadSteamInfo, response: DepotDownloaderEvent};
    "download-bs-version": { request: DownloadSteamInfo, response: DepotDownloaderEvent};
    "download-bs-version-qr": { request: DownloadSteamInfo, response: DepotDownloaderEvent};
    "stop-download-bs-version": { request: void, response: void};
    "send-input-bs-download": { request: string, response: boolean};
    "bs-oculus-download": { request: DownloadInfo, response: Progression<BSVersion>};
    "bs-oculus-stop-download": { request: void, response: void};

    /* ** beat-saver-ipcs ** */
    "bsv-search-map": {request: SearchParams, response: BsvMapDetail[]};
    "bsv-get-map-details-from-hashs": {request: string[], response: BsvMapDetail[]};
    "bsv-get-map-details-by-id": {request: string, response: BsvMapDetail};
    "bsv-search-playlist": {request: PlaylistSearchParams, response: BsvPlaylist[]};
    "bsv-get-playlist-details-by-id": {request: {id: string, page: number}, response: BsvPlaylistPage};

    /* ** bs-launcher-ipcs ** */
    "create-launch-shortcut": { request: LaunchOption, response: boolean };
    "bs-launch.need-start-as-admin": { request: void, response: boolean };
    "bs-launch.launch": { request: LaunchOption, response: BSLaunchEventData };
    "bs-launch.restore-steamvr": { request: void, response: void };

    /* ** bs-maps-ipcs ** */
    "load-version-maps": { request: BSVersion, response: BsmLocalMapsProgress};
    "delete-maps": { request: BsmLocalMap[], response: DeleteMapsProgress };
    "export-maps": { request: { version: BSVersion; maps: BsmLocalMap[]; outPath: string }, response: Progression };
    "download-map": { request: { map: BsvMapDetail; version: BSVersion }, response: BsmLocalMap };
    "one-click-install-map": { request: BsvMapDetail, response: void };
    "register-maps-deep-link": { request: void, response: boolean };
    "unregister-maps-deep-link": { request: void, response: boolean };
    "is-map-deep-links-enabled": { request: void, response: boolean };
    "get-maps-info-from-cache": { request: string[], response: SongDetails[] }

    /* ** bs-model-ipcs ** */
    "one-click-install-model": { request: MSModel, response: void };
    "register-models-deep-link": { request: void, response: boolean };
    "unregister-models-deep-link": { request: void, response: boolean };
    "is-models-deep-links-enabled": { request: void, response: boolean };
    "download-model": { request: ModelDownload, response: Progression<BsmLocalModel> };
    "get-version-models": { request: { version: BSVersion; type: MSModelType }, response: Progression<BsmLocalModel[]> };
    "export-models": { request: { version: BSVersion; models: BsmLocalModel[]; outPath: string }, response: Progression };
    "delete-models": { request: BsmLocalModel[], response: Progression<BsmLocalModel[]> };

    /* ** bs-mods-ipcs ** */
    "get-available-mods": { request: BSVersion, response: Mod[] };
    "get-installed-mods": { request: BSVersion, response: Mod[] };
    "install-mods": { request: { mods: Mod[]; version: BSVersion }, response: InstallModsResult };
    "uninstall-mods": { request: { mods: Mod[]; version: BSVersion }, response: UninstallModsResult };
    "uninstall-all-mods": { request: BSVersion, response: UninstallModsResult };

    /* ** bs-playlist-ipcs ** */
    "one-click-install-playlist": { request: string, response: Progression<DownloadPlaylistProgressionData> };
    "register-playlists-deep-link": { request: void, response: boolean };
    "unregister-playlists-deep-link": { request: void, response: boolean };
    "is-playlists-deep-links-enabled": { request: void, response: boolean };
    "download-playlist": {request: {downloadSource: string, dest?: string, version?: BSVersion, ignoreSongsHashs?: string[]}, response: Progression<DownloadPlaylistProgressionData>};
    "get-version-playlists-details": {request: BSVersion, response: Progression<LocalBPListsDetails[]>};
    "delete-playlist": {request: {version: BSVersion, bpList: LocalBPList, deleteMaps?: boolean}, response: Progression};
    "export-playlists": {request: {version?: BSVersion, bpLists: LocalBPList[], dest: string, playlistsMaps?: BsmLocalMap[]}, response: Progression<string>};
    "install-playlist-file": {request: {bplist: BPList, version?: BSVersion, dest?: string}, response: LocalBPListsDetails};

    /* ** bs-uninstall-ipcs ** */
    "bs.uninstall": { request: BSVersion, response: boolean };

    /* ** bs-version-ipcs ** */
    "bs-version.get-version-dict": { request: void, response: BSVersion[] };
    "bs-version.installed-versions": { request: void, response: BSVersion[] };
    "bs-version.open-folder": { request: BSVersion, response: void };
    "bs-version.edit": { request: { version: BSVersion; name: string; color: string }, response: BSVersion };
    "bs-version.clone": { request: { version: BSVersion; name: string; color: string }, response: BSVersion };
    "get-version-full-path": { request: BSVersion, response: string };
    "full-version-path-to-relative": { request: { version: BSVersion; fullPath: string }, response: string };
    "get-linked-folders": { request: { version: BSVersion; options?: { relative?: boolean } }, response: string[] };
    "link-version-folder-action": { request: VersionLinkerAction, response: boolean };
    "is-version-folder-linked": { request: { version: BSVersion; relativeFolder: string }, response: boolean };
    "relink-all-versions-folders": { request: void, response: void };

    /* ** launcher-ipcs ** */
    "download-update": { request: void, response: boolean };
    "check-update": { request: void, response: boolean };
    "install-update": { request: void, response: void };

    /* ** model-saber.ipcs ** */
    "ms-get-model-by-id": { request: string | number, response: MSModel };
    "search-models": { request: MSGetQuery, response: MSModel[] };

    /* ** os-controls-ipcs ** */
    "new-window": { request: string, response: void };
    "choose-folder": { request: string, response: OpenDialogReturnValue };
    "choose-file": { request: string, response: OpenDialogReturnValue }
    "choose-image": { request: { multiple?: boolean, base64?: boolean }, response: string[] }
    "window.progression": { request: number, response: void };
    "save-file": { request: { filename?: string; filters?: FileFilter[] }, response: string };
    "current-version": { request: void, response: string };
    "open-logs": { request: void, response: string };
    "notify-system": { request: SystemNotificationOptions, response: void };
    "view-path-in-explorer": { request: string, response: void };

    /* ** supporters-ipcs ** */
    "get-supporters": { request: void, response: Supporter[] };

    /* **window-manager-ipcs ** */
    "close-window": { request: void, response: void };
    "maximise-window": { request: void, response: void };
    "minimise-window": { request: void, response: void };
    "unmaximise-window": { request: void, response: void };
    "open-window-then-close-all": { request: AppWindow, response: void };
    "open-window-or-focus": { request: AppWindow, response: void };

    /* ** OTHERS (if your IPC channel is not in a "-ipcs" file, put it here) ** */
    "shortcut-launch-options": { request: void, response: LaunchOption };
}

export type IpcRequestType<Channel extends keyof IpcChannelMapping> = IpcChannelMapping[Channel]['request'];
export type IpcResponseType<Channel extends keyof IpcChannelMapping> = IpcChannelMapping[Channel]['response'];
export type IpcChannels = keyof IpcChannelMapping;
