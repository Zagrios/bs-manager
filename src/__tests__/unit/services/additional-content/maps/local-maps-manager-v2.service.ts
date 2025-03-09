import path from "path";
import { ASSETS_FOLDER } from "__tests__/consts";
import { createLocalMapsManagerServiceV2 } from "main/services/additional-content/maps/local-maps-manager-v2.service";
import { lastValueFrom } from "rxjs";
import { deleteFolder } from "main/helpers/fs.helpers";
import { ensureDir, existsSync, readdirSync } from "fs-extra";

jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

const TEST_FOLDER = path.join(ASSETS_FOLDER, "zip");
const OUTPUT_FOLDER = path.join(ASSETS_FOLDER, "out");
const VERSION_FOLDER = path.join(OUTPUT_FOLDER, "version");
const SHARED_FOLDER = path.join(OUTPUT_FOLDER, "shared");
const PREFIX_FOLDER = path.join("SharedMaps", "CustomLevels");

const SAMPLE_MAP_ZIPS = [path.join(TEST_FOLDER, "sample_map_1.zip"), path.join(TEST_FOLDER, "sample_map_2.zip"), path.join(TEST_FOLDER, "sample_map_3.zip")];

const localMapsManagerV2 = createLocalMapsManagerServiceV2({
    // Unused in testing
    localVersionService: {
        getVersionPath: async () => VERSION_FOLDER,
    },
    installLocationService: {
        sharedContentPath: () => SHARED_FOLDER,
    },
    songCacheService: {
        getMapInfoFromDirname: () => ({
            hash: "some-hash-here",
            mapInfo: {
                version: "1.0",
                songName: "some song name",
                songAuthorName: "some author name",
                levelMappers: ["1st mapper"],
                levelLighters: [],
                beatsPerMinute: 777,
                previewStartTime: 0,
                previewDuration: 1000,
                songFilename: "song.wav",
                songPreviewFilename: "song-preview.wav",
                coverImageFilename: "cover.png",
                environmentNames: [],
                difficulties: [],
            },
        }),
    },
    songDetailsCacheService: {
        getSongDetails: () => undefined,
    },
});

describe("Test local-maps-manager-v2.service.ts", () => {
    beforeAll(async () => {
        if (existsSync(OUTPUT_FOLDER)) {
            await deleteFolder(OUTPUT_FOLDER).catch(() => {});
        }
        await ensureDir(OUTPUT_FOLDER);
    });

    afterEach(async () => {
        await deleteFolder(OUTPUT_FOLDER);
    });

    it("Import a single map zip file to shared (info.dat)", async () => {
        await lastValueFrom(localMapsManagerV2.importMaps(SAMPLE_MAP_ZIPS.slice(0, 1)));
        const folder = path.resolve(SHARED_FOLDER, PREFIX_FOLDER, "sample_map_1");

        expect(existsSync(folder)).toBe(true);
        expect(existsSync(path.join(folder, "info.dat"))).toBe(true);
        expect(readdirSync(folder).length).toBe(1);
    });

    it("Import a single map zip file to shared (Info.dat)", async () => {
        await lastValueFrom(localMapsManagerV2.importMaps(SAMPLE_MAP_ZIPS.slice(1, 2)));
        const folder = path.resolve(SHARED_FOLDER, PREFIX_FOLDER, "sample_map_2");

        expect(existsSync(folder)).toBe(true);
        expect(existsSync(path.join(folder, "Info.dat"))).toBe(true);
        expect(readdirSync(folder).length).toBe(1);
    });

    it("Import a multi map zip file to shared", async () => {
        await lastValueFrom(localMapsManagerV2.importMaps(SAMPLE_MAP_ZIPS.slice(2, 3)));
        const folder = path.resolve(SHARED_FOLDER, PREFIX_FOLDER);

        expect(existsSync(folder)).toBe(true);
        expect(readdirSync(folder).length).toBe(4);

        for (let i = 1; i <= 4; ++i) {
            expect(existsSync(path.join(folder, `map_${i}`))).toBe(true);
        }
    });

    it("Import all zip files", async () => {
        await lastValueFrom(localMapsManagerV2.importMaps(SAMPLE_MAP_ZIPS));
        const folder = path.resolve(SHARED_FOLDER, PREFIX_FOLDER);

        expect(existsSync(folder)).toBe(true);
        expect(readdirSync(folder).length).toBe(6);

        expect(existsSync(path.join(folder, "sample_map_1", "info.dat"))).toBe(true);
        expect(existsSync(path.join(folder, "sample_map_2", "Info.dat"))).toBe(true);
        for (let i = 1; i <= 4; ++i) {
            expect(existsSync(path.join(folder, `map_${i}`))).toBe(true);
        }
    });

});
