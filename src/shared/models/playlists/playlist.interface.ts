import { BsvMapDetail } from "../maps"

export interface BPList {
    playlistTitle: string,
    playlistAuthor: string,
    playlistDescription?: string,
    image: string,
    customData: unknown,
    songs: PlaylistSong[]
}

export interface PlaylistSong {
    key: string,
    hash: string,
    songName: string,
    uploader?: string
}

export interface DownloadPlaylistProgression {
    mapsPath: string[],
    downloadedMaps: BsvMapDetail[],
    bpListPath: string,
    current: BsvMapDetail,
    progression: number
}