import { BPList } from "./playlist.interface";

export interface LocalBPList extends BPList {
    path: string;
}

export interface LocalBPListsDetails extends LocalBPList {
    nbMaps: number;
    id?: number;
    nbMappers?: number;
    duration?: number;
    minNps?: number;
    maxNps?: number;
}


