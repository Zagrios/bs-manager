export interface Mod {
    _id: string,
    name: string,
    version: string,
    gameVersion: string,
    authorId: string,
    uploadedDate: string,
    updatedDate: string,
    author: ModAuthor,
    description: string,
    link: string,
    category: string,
    downloads: DownloadLink[],
    required: boolean,
    dependencies: Mod[],
    status: string

}

export interface ModAuthor {
    _id: string,
    username: string,
    lastLogin: string,
}

export interface DownloadLink {
    type: DownloadLinkType,
    url: string,
    hashMd5: FileHashes[]
}

export type DownloadLinkType = "universal"|"steam"|"oculus";

export interface FileHashes {
    hash: string,
    file: string
}

export interface ModInstallProgression{
    name: string,
    progression: number
}