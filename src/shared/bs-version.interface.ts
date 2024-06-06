import { BsStore } from "./models/bs-store.enum";

export type BSVersionString = `${number}.${number}.${string}`; // 1.1.0p1

export interface PartialBSVersion {
    BSVersion: BSVersionString,
    name?: string
    ino?: number,
}

export interface BSVersion extends PartialBSVersion {
    BSManifest?: string;
    ReleaseURL?: string;
    ReleaseImg?: string;
    ReleaseDate?: string;
    year?: string;
    steam?: boolean;
    oculus?: boolean;
    color?: string; // TODO : Should be in metadata
    OculusBinaryId?: string;
    metadata?: BSVersionMetadata;
    recommended?: boolean;
}

export interface BSVersionMetadata {
    id: string;
    store: BsStore;
}


