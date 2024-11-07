import path from "path";
import { mkdir, pathExistsSync, rm } from "fs-extra";
import { extractZip } from "main/helpers/zip.helpers";

const TEST_FOLDER = path.resolve(__dirname, "../../..", "assets", "tests");
const STANDARD_ZIP = path.join(TEST_FOLDER, "standard.zip");
const WINDOWS_LEGACY_MAP_ZIP = path.join(TEST_FOLDER, "windows_legacy.zip");
const DESTINATION_FOLDER = path.join(TEST_FOLDER, "out");

describe("Zip Server Service Test", () => {
    beforeAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
        await mkdir(DESTINATION_FOLDER);
    });

    // Uses '/'
    it("Extract standard zip", async () => {
        await extractZip(STANDARD_ZIP, DESTINATION_FOLDER);

        for (const file of [
            "file_1.2.txt",
            "file_1.3.txt",
        ]) {
            expect(pathExistsSync(path.join(DESTINATION_FOLDER, file)))
                .toBe(true);
        }

        const SUBFOLDER_PATH = path.join(DESTINATION_FOLDER, "folder_1.1");
        for (const file of [
            "file_2.1.txt",
            "file_2.2.txt",
        ]) {
            expect(pathExistsSync(path.join(SUBFOLDER_PATH, file)))
                .toBe(true);
        }
    });

    // Uses '\\'
    it("Extract map zips using forward slashes", async () => {
        await extractZip(WINDOWS_LEGACY_MAP_ZIP, DESTINATION_FOLDER);

        // Expect all the files to exists
        for (const file of [
            "BPMInfo.dat",
            "cover.jpg",
            "ExpertLegacy.dat",
            "ExpertPlusLawless.dat",
            "ExpertPlusLegacy.dat",
            "ExpertPlusStandard.dat",
            "ExpertStandard.dat",
            "Info.dat",
            "song.egg",
        ]) {
            expect(pathExistsSync(path.join(DESTINATION_FOLDER, file)))
                .toBe(true);
        }

        const SUBFOLDER_PATH = path.join(DESTINATION_FOLDER, "pfp");
        for (const file of [
            "galaxyCompressed.jpg",
            "gojiCompressed.jpg",
        ]) {
            expect(pathExistsSync(path.join(SUBFOLDER_PATH, file)))
                .toBe(true);
        }
    });

    afterAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
    });
});
