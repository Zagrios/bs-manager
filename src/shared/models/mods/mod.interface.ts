export interface Mod {
    _id: string;
    name: string;
    version: string;
    gameVersion: string;
    authorId: string;
    uploadedDate: string;
    updatedDate: string;
    author: ModAuthor;
    description: string;
    link: string;
    category: string;
    downloads: DownloadLink[];
    required: boolean;
    dependencies: Mod[];
    status: string;
}

export interface ModAuthor {
    _id: string;
    username: string;
    lastLogin: string;
}

export interface DownloadLink {
    type: DownloadLinkType;
    url: string;
    hashMd5: FileHashes[];
}

export type DownloadLinkType = "universal" | "steam" | "oculus";

export interface FileHashes {
    hash: string;
    file: string;
}

// BBM MOD

export interface BbmModVersion {
    id: number;
    modId: number;
    author: BbmUserAPIResponse;
    modVersion: string;
    platform: BbmPlatform;
    zipHash: string;
    status: BbmStatus;
    dependencies: number[];
    contentHashes: BbmContentHash[];
    supportedGameVersions: BbmGameVersion[];
    downloadCount: number;
    lastApprovedById?: number;
    lastUpdatedById?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface BbmContentHash {
    path: string;
    hash: string;
}

export enum BbmStatus {
    Private = "private",
    Removed = "removed",
    Unverified = "unverified",
    Verified = "verified",
}

export enum BbmPlatform {
    SteamPC = `steampc`,
    OculusPC = `oculuspc`,
    UniversalPC = `universalpc`,
    UniversalQuest = `universalquest`,
}

export interface BbmGameVersion {
    readonly id: number;
    gameName: "BeatSaber";
    version: string; // semver
    defaultVersion: boolean;
}

export enum BbmCategories {
    Core = "core",
    Essential = "essential",
    Library = "library",
    Cosmetic = "cosmetic",
    PracticeTraining = "practice",
    Gameplay = "gameplay",
    StreamTools = "streamtools",
    UIEnhancements = "ui",
    Lighting = "lighting",
    TweaksTools = "tweaks",
    Multiplayer = "multiplayer",
    TextChanges = "text",
    Editor = "editor",
    Other = "other",
}

export interface BbmUserAPIResponse {
    id: number;
    username: string;
    githubId: string;
    sponsorUrl: string;
    displayName: string;
    bio: string;
    createdAt?: Date;
    updatedAt?: Date;
}
