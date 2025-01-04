import { BSVersion } from "shared/bs-version.interface";

export function getVersionName(version: BSVersion) {
    let { name } = version;
    if (!name) {
        name = version.steam
            ? "Steam" : "Oculus";
    }
    return `${version.BSVersion} - ${name}`;
}
