import { BSVersion } from "shared/bs-version.interface";

export function getVersionName(version: BSVersion) {
    if (version.steam) {
        return `${version.BSVersion} - Steam`;
    }

    if (version.oculus) {
        return `${version.BSVersion} - Oculus`;
    }

    const { name } = version;
    return name ? `${version.BSVersion} - ${name}` : version.BSVersion;
}
