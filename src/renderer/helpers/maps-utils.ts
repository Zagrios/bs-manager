import { BsvMapDetail } from "shared/models/maps";

export function getMapZipUrlFromMapDetails(map: BsvMapDetail){
    const hash = map.versions.at(0).hash;
    return getMapZipUrlFromHash(hash);
}

export function getMapZipUrlFromHash(hash: string){
    return `https://r2cdn.beatsaver.com/${hash}.zip`;
}