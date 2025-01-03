// Any mods that are not supported in beatmods
export interface ExternalMod {
    name: string;
    files: string[];
}

// BBM Mods

export interface BbmFullMod {
    mod: BbmMod;
    version: BbmModVersion;
}

export interface BbmMod {
    id: number;
    name: string;
    summary: string;
    description: string;
    gameName: "BeatSaber";
    category: BbmCategories;
    authors: BbmUserAPIResponse[];
    status: BbmStatus;
    iconFileName: string;
    gitUrl: string;
    lastApprovedById: number;
    lastUpdatedById: number;
    createdAt: Date;
    updatedAt: Date;
}

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
