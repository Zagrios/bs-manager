import { BsStore } from "./models/bs-store.enum";

export interface PartialBSVersion {
    BSVersion: string,
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
}

export interface BSVersionMetadata {
    store: BsStore;
}


