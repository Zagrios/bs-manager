import path from "path";
import { mkdir, pathExistsSync, readFile, rm } from "fs-extra";
import { extractZip, getFilesFromZip } from "main/helpers/zip.helpers";
import { YauzlZip } from "main/models/yauzl-zip.class";

const TEST_FOLDER = path.resolve(__dirname, "../../..", "assets", "tests");
const STANDARD_ZIP = path.join(TEST_FOLDER, "standard.zip");
const WINDOWS_LEGACY_MAP_ZIP = path.join(TEST_FOLDER, "windows_legacy.zip");
const SUBFOLDERS_ZIP = path.join(TEST_FOLDER, "subfolders.zip");
const MANIFEST_ZIP = path.join(TEST_FOLDER, "manifest.zip");
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
        const beforeExtractedFolders: string[] = [];
        const afterExtractedFolders: string[] = [];
        await extractZip(WINDOWS_LEGACY_MAP_ZIP, DESTINATION_FOLDER, {
            beforeFolderExtracted: (folder) => beforeExtractedFolders.push(folder),
            afterFolderExtracted: (folder) => afterExtractedFolders.push(folder),
        });

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

        expect(beforeExtractedFolders).toContain(".");
        expect(beforeExtractedFolders).toContain("pfp");
        expect(beforeExtractedFolders.length).toBe(2);

        expect(afterExtractedFolders).toContain(".");
        expect(afterExtractedFolders).toContain("pfp");
        expect(afterExtractedFolders.length).toBe(2);
    });

    it("Extract manifest.json from zip file", async () => {
        const zipBuffer = await readFile(MANIFEST_ZIP);
        const buffers = await getFilesFromZip(zipBuffer, ["manifest.json"]);
        const manifest = JSON.parse(buffers["manifest.json"].toString());
        expect(manifest).toBeTruthy();

        // Check some of the fields if they are correct
        expect(manifest.appId).toBe("some-app-id");
        expect(manifest.canonicalName).toBe("some-canonical-name");
        expect(manifest.isCore).toBe(true);
    });

    afterAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
    });
});

describe("Test YauzlZip class", () => {

    beforeAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
        await mkdir(DESTINATION_FOLDER);
    });



    it("Extract standard zip", async () => {

        const zip = await YauzlZip.fromPath(STANDARD_ZIP);
        const res = await zip.extract(DESTINATION_FOLDER);

        expect(res.sort()).toEqual([
            "file_1.2.txt",
            "file_1.3.txt",
            "folder_1.1/",
            "folder_1.1/file_2.1.txt",
            "folder_1.1/file_2.2.txt",
        ].sort())

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

    it("Extract map zips using back slashes", async () => {

        const zip = await YauzlZip.fromPath(WINDOWS_LEGACY_MAP_ZIP);
        const res = await zip.extract(DESTINATION_FOLDER);

        expect(res.sort()).toEqual([
            "BPMInfo.dat",
            "cover.jpg",
            "ExpertLegacy.dat",
            "ExpertPlusLawless.dat",
            "ExpertPlusLegacy.dat",
            "ExpertPlusStandard.dat",
            "ExpertStandard.dat",
            "Info.dat",
            "song.egg",
            "pfp/",
            "pfp/galaxyCompressed.jpg",
            "pfp/gojiCompressed.jpg",
        ].sort());

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

    it("Read Zip with multiple subfolders", async () => {

            const zip = await YauzlZip.fromPath(SUBFOLDERS_ZIP);
            const res = await zip.extract(DESTINATION_FOLDER);

            expect(res.sort()).toEqual([
                "1/",
                "1/2/",
                "1/2/3/",
                "1/2/3/4/",
                "1/2/3/4/5.txt",
            ].sort());

            for (const folder of [
                "1/",
                "1/2/",
                "1/2/3/",
                "1/2/3/4/",
            ]) {
                expect(pathExistsSync(path.join(DESTINATION_FOLDER, folder)))
                    .toBe(true);
            }

            const file = "1/2/3/4/5.txt";
            expect(pathExistsSync(path.join(DESTINATION_FOLDER, file)))
                .toBe(true);
    });

    it("Read manifest.json from zip file", async () => {

        const zipBuffer = await readFile(MANIFEST_ZIP);
        const zip = await YauzlZip.fromBuffer(zipBuffer);
        const buffer = await (await zip.findEntry(entry => entry.fileName === "manifest.json")).read();
        const manifest = JSON.parse(buffer.toString());
        expect(manifest).toBeTruthy();

        // Check some of the fields if they are correct
        expect(manifest.appId).toBe("some-app-id");
        expect(manifest.canonicalName).toBe("some-canonical-name");
        expect(manifest.isCore).toBe(true);
    });



    afterAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
    });

})
