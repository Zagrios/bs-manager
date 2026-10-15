import path from "path";
import { ensureDir, readJson } from "fs-extra";
import { BSVersion } from "shared/bs-version.interface";
import { BsStore } from "shared/models/bs-store.enum";
import { SteamDownloadRequest } from "shared/models/bs-version-download/steam-download.model";
import { ensurePathNotAlreadyExist } from "../../helpers/fs.helpers";

export interface SteamDownloadLocations {
    depot: string;
    versionPath(version: BSVersion): Promise<string>;
    versionsDirectory(): string;
}

export async function resolveSteamDownloadDestination(request: SteamDownloadRequest, locations: SteamDownloadLocations): Promise<{ directory: string; version: BSVersion }> {
    const versionPath = await locations.versionPath(request.bsVersion);
    const pending = await readJson(path.join(versionPath, ".bs-download", "pending.json")).catch((): undefined => undefined);
    const resumable = pending?.depot === locations.depot && pending?.manifest === String(request.bsVersion.BSManifest);
    const directory = request.isVerification || resumable ? versionPath : await ensurePathNotAlreadyExist(versionPath);
    const version: BSVersion = {
        ...request.bsVersion,
        ...(path.basename(directory) !== request.bsVersion.BSVersion && { name: path.basename(directory) }),
        metadata: { store: BsStore.STEAM, id: "" },
    };

    await ensureDir(locations.versionsDirectory());
    return { directory, version };
}
