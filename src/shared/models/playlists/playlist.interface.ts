export interface Playlist {
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