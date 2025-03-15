import crypto, { BinaryLike } from "crypto";
import log from "electron-log";
import path from "path";
import { Observable, Subscriber } from "rxjs";
import { BSVersion } from "shared/bs-version.interface";
import { BsmLocalMap } from "shared/models/maps/bsm-local-map.interface";
import { Progression, ensureFolderExist, getFilesInFolder } from "main/helpers/fs.helpers";
import { BsmZipExtractor } from "main/models/bsm-zip-extractor.class";
import { createReadStream, pathExists, pathExistsSync, readFile } from "fs-extra";
import { escapeRegExp } from "shared/helpers/string.helpers";
import { CustomError } from "shared/models/exceptions/custom-error.class";
import { MapInfo } from "shared/models/maps/info/map-info.model";
import { pathToFileURL } from "url";
import { tryit } from "shared/helpers/error.helpers";
import { parseMapInfoDat } from "shared/parsers/maps/map-info.parser";
import { LocalMapsManagerServiceV2, LocalMapsManagerServiceV2Params } from "./types";

interface ImportMapsImplParams {
    nbImportedMaps: number;
    abortController: AbortController;
    zip?: BsmZipExtractor;
    version?: BSVersion;
}

const LEVELS_ROOT_FOLDER = "Beat Saber_Data";
const CUSTOM_LEVELS_FOLDER = "CustomLevels";
const RELATIVE_MAPS_FOLDER = path.join(LEVELS_ROOT_FOLDER, CUSTOM_LEVELS_FOLDER);
const SHARED_MAPS_FOLDER = "SharedMaps";

export function createLocalMapsManagerServiceV2({
    localVersionService,
    installLocationService,
    songCacheService,
    songDetailsCacheService
}: LocalMapsManagerServiceV2Params): LocalMapsManagerServiceV2 {
    // === PRIVATE === //
    const computeMapHash = async (mapPath: string, rawInfoString: string): Promise<string> => {
        const { result: mapInfo, error } = tryit(() => parseMapInfoDat(JSON.parse(rawInfoString)));

        if (!mapInfo || error) {
            log.error(`Unable to cumpute hash, cannot parse map info at ${mapPath}`, error);
            throw CustomError.fromError(
                error, `Unable to cumpute hash, cannot parse map info at ${mapPath}`,
                "cannot-parse-map-info"
            );
        }

        const shasum = crypto.createHash("sha1");
        shasum.update(rawInfoString);

        const hashFile = (filePath: string): Promise<void> => {
            return new Promise<void>((resolve, reject) => {
                const stream = createReadStream(filePath);
                stream.on("data", data => shasum.update(data as BinaryLike));
                stream.on("error", reject);
                stream.on("close", resolve);
            });
        };

        for (const diff of mapInfo.difficulties) {
            if (diff.beatmapFilename) {
                const diffFilePath = path.join(mapPath, diff.beatmapFilename);
                await hashFile(diffFilePath);
            }

            if (diff.lightshowDataFilename) {
                const lightshowFilePath = path.join(mapPath, diff.lightshowDataFilename);
                await hashFile(lightshowFilePath);
            }
        }

        return shasum.digest("hex");
    };

    const loadMapInfoFromPath = async (mapPath: string): Promise<BsmLocalMap> => {
        const getUrlsAndReturn = (mapInfo: MapInfo, hash: string, mapPath: string): BsmLocalMap => {
            const coverUrl = pathToFileURL(path.join(mapPath, mapInfo.coverImageFilename)).href;
            const songUrl = pathToFileURL(path.join(mapPath, mapInfo.songFilename)).href;
            return {
                mapInfo,
                coverUrl,
                songUrl,
                hash,
                path: mapPath,
                songDetails: songDetailsCacheService.getSongDetails(hash),
            };
        };

        const cachedMapInfos = songCacheService.getMapInfoFromDirname(path.basename(mapPath));

        if (cachedMapInfos) {
            return getUrlsAndReturn(cachedMapInfos.mapInfo, cachedMapInfos.hash, mapPath);
        }

        const files = await getFilesInFolder(mapPath);
        const infoFile = files.find(file => path.basename(file).toLowerCase() === "info.dat");

        if (infoFile === null) {
            return null;
        }

        const rawInfoString = await readFile(infoFile, { encoding: "utf-8" });
        const { result: mapInfo, error } = tryit(() => parseMapInfoDat(JSON.parse(rawInfoString)));

        if (error) {
            log.error(`Cannot parse map info.dat. Map path: ${mapPath}`, error);
            throw CustomError.fromError(
                error, `Cannot read map info.dat. Map path: ${mapPath}`,
                "cannot-parse-map-info"
            );
        }

        const hash = await computeMapHash(mapPath, rawInfoString);

        return getUrlsAndReturn(mapInfo, hash, mapPath);
    };

    const getMapsFolderPath = async (version?: BSVersion): Promise<string> => {
        if (version) {
            return path.join(await localVersionService.getVersionPath(version), RELATIVE_MAPS_FOLDER);
        }
        const sharedMapsPath = path.join(
            installLocationService.sharedContentPath(),
            SHARED_MAPS_FOLDER, CUSTOM_LEVELS_FOLDER
        );
        if (!(await pathExists(sharedMapsPath))) {
            await ensureFolderExist(sharedMapsPath);
        }
        return sharedMapsPath;
    };

    const importMapsImpl = async (
        zipPaths: string[],
        obs: Subscriber<Progression<BsmLocalMap, unknown>>,
        params: ImportMapsImplParams
    ): Promise<void> => {
        let progress: Progression<BsmLocalMap> = { total: 0, current: 0 };
        const mapsPath = await getMapsFolderPath(params.version);

        for (const zipPath of zipPaths) {
            if (params.abortController.signal?.aborted) {
                log.info("Maps import from zip has been cancelled");
                return;
            }

            progress = { total: 0, current: 0 };
            obs.next(progress); // reset progress for each zip

            if (!pathExistsSync(zipPath)) {
                continue;
            }

            params.zip = await BsmZipExtractor.fromPath(zipPath);
            const mapsFolders = (await params.zip
                .filterEntries(entry => /(^|\/)[Ii]nfo\.dat$/.test(entry.fileName)))
                .map(entry => path.dirname(entry.fileName));

            if (mapsFolders.length === 0) {
                log.warn('No maps "info.dat" found in zip', zipPath);
                progress.total = 1;
                progress.current = 1;
                obs.next(progress);
                continue;
            }

            progress.total = mapsFolders.length;
            obs.next(progress);

            const isRoot = mapsFolders.length === 1 && mapsFolders[0] === ".";
            const destination = isRoot
                ? path.join(mapsPath, path.basename(zipPath, ".zip"))
                : mapsPath;

            log.info("Extracting", `"${zipPath}"`, "into", `"${mapsPath}"`);
            for (const folder of mapsFolders) {
                log.info(">", folder);

                const entriesNames = isRoot
                    ? null
                    : [new RegExp(`^${escapeRegExp(folder)}\\/`)];

                const exported = await params.zip.extract(destination, {
                    entriesNames,
                    abortToken: params.abortController,
                });

                if (exported.length === 0) {
                    log.warn("No files extracted from", folder);
                    continue;
                }

                if (params.abortController.signal?.aborted) {
                    break;
                }

                ++params.nbImportedMaps;
                ++progress.current;
                progress.data = await loadMapInfoFromPath(path.join(destination, folder));
                obs.next(progress);

                if (params.abortController.signal?.aborted) {
                    break;
                }
            }

            params.zip.close();

            if (params.abortController.signal?.aborted) {
                log.info("Maps import from zip has been cancelled");
                return;
            }
        }
    };

    return {
        getMapsFolderPath,

        importMaps(zipPaths, version?) {
            return new Observable<Progression<BsmLocalMap>>(obs => {
                const data: ImportMapsImplParams = {
                    nbImportedMaps: 0,
                    abortController: new AbortController(),
                    version,
                };

                importMapsImpl(zipPaths, obs, data)
                    .then(() => {
                        if (!data.nbImportedMaps) {
                            throw new CustomError(
                                'No "Info.dat" file located in any of the zip files',
                                "invalid-zip"
                            );
                        }
                        return log.info(
                            "Successfully imported", data.nbImportedMaps,
                            "maps from", zipPaths.length, "zips"
                        );
                    })
                    .catch(e => obs.error(e))
                    .finally(() => {
                        if (data.zip) {
                            data.zip.close();
                        }
                        obs.complete();
                    });

                return () => {
                    data.abortController.abort();
                };
            });
        },
    };
}
