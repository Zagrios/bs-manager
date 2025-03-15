import path from "path";
import { mkdir, pathExistsSync, readFile, rm } from "fs-extra";
import { BsmZipExtractor } from "main/models/bsm-zip-extractor.class";
import { ASSETS_FOLDER } from "__tests__/consts";

const TEST_FOLDER = path.resolve(ASSETS_FOLDER, "zip");
const STANDARD_ZIP = path.join(TEST_FOLDER, "standard.zip");
const WINDOWS_LEGACY_MAP_ZIP = path.join(TEST_FOLDER, "windows_legacy.zip");
const SUBFOLDERS_ZIP = path.join(TEST_FOLDER, "subfolders.zip");
const MANIFEST_ZIP = path.join(TEST_FOLDER, "manifest.zip");
const EMPTY_ZIP = path.join(TEST_FOLDER, "empty.zip");
const UNICODE_ZIP = path.join(TEST_FOLDER, "unicode.zip");
const DESTINATION_FOLDER = path.join(TEST_FOLDER, "out");

describe("Test BsmZipExtractor class", () => {
    let zip: BsmZipExtractor;

    beforeAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
        await mkdir(DESTINATION_FOLDER);
    });

    afterEach(async () => {
        if (zip) {
            zip.close();
        }
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
        await mkdir(DESTINATION_FOLDER);
    });

    afterAll(async () => {
        if (pathExistsSync(DESTINATION_FOLDER)) {
            await rm(DESTINATION_FOLDER, { recursive: true, force: true });
        }
    });

    it("Extract standard zip", async () => {

        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
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

        zip = await BsmZipExtractor.fromPath(WINDOWS_LEGACY_MAP_ZIP);
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

            const zip = await BsmZipExtractor.fromPath(SUBFOLDERS_ZIP);
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
        zip = await BsmZipExtractor.fromBuffer(zipBuffer);
        const buffer = await (await zip.findEntry(entry => entry.fileName === "manifest.json")).read();
        const manifest = JSON.parse(buffer.toString());
        expect(manifest).toBeTruthy();

        // Check some of the fields if they are correct
        expect(manifest.appId).toBe("some-app-id");
        expect(manifest.canonicalName).toBe("some-canonical-name");
        expect(manifest.isCore).toBe(true);
    });


    it("Should find an entry using findEntry", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
        const entry = await zip.findEntry(entry => entry.fileName === "file_1.2.txt");

        expect(entry).toBeTruthy();
        expect(entry.fileName).toBe("file_1.2.txt");

        const contentBuffer = await entry.read();
        const content = contentBuffer.toString();

        expect(content).toContain("This is file 1.2"); // Assurez-vous que le contenu correspond
    });

    it("Should filter entries using filterEntries", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
        const entries = await zip.filterEntries(entry => !entry.isDirectory && entry.fileName.startsWith("folder_1.1/"));

        expect(entries.length).toBe(2);
        const fileNames = entries.map(entry => entry.fileName).sort();

        expect(fileNames).toEqual([
            "folder_1.1/file_2.1.txt",
            "folder_1.1/file_2.2.txt",
        ]);
    });

    it("Should get an entry by file name using getEntry", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
        const entry = await zip.getEntry("file_1.3.txt");

        expect(entry).toBeTruthy();
        expect(entry.fileName).toBe("file_1.3.txt");

        const contentBuffer = await entry.read();
        const content = contentBuffer.toString();

        expect(content).toContain("This is file 1.3"); // Assurez-vous que le contenu correspond
    });

    it("Should extract only specified entries using entriesNames option", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
        const res = await zip.extract(DESTINATION_FOLDER, { entriesNames: ["file_1.2.txt", "folder_1.1/file_2.1.txt"] });

        expect(res.sort()).toEqual([
            "file_1.2.txt",
            "folder_1.1/",
            "folder_1.1/file_2.1.txt",
        ].sort());

        for (const file of [
            "file_1.2.txt",
            "folder_1.1/file_2.1.txt",
        ]) {
            expect(pathExistsSync(path.join(DESTINATION_FOLDER, file)))
                .toBe(true);
        }

        // Vérifiez que les autres fichiers ne sont pas extraits
        expect(pathExistsSync(path.join(DESTINATION_FOLDER, "file_1.3.txt")))
            .toBe(false);
        expect(pathExistsSync(path.join(DESTINATION_FOLDER, "folder_1.1/file_2.2.txt")))
            .toBe(false);
    });

    it("Should not extract any files if abortToken is already aborted", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);
        const abortController = new AbortController();

        // Abortez avant d'appeler extract
        abortController.abort();

        const res = await zip.extract(DESTINATION_FOLDER, { abortToken: abortController });

        expect(res.length).toBe(0);

        // Vérifiez qu'aucun fichier n'a été extrait
        expect(pathExistsSync(path.join(DESTINATION_FOLDER, "file_1.2.txt")))
            .toBe(false);
    });


    it("Should throw an error when opening a non-existent zip file", async () => {
        await expect(BsmZipExtractor.fromPath("non_existent.zip"))
            .rejects
            .toThrow();
    });

    it("Should handle empty zip file correctly", async () => {
        zip = await BsmZipExtractor.fromPath(EMPTY_ZIP);
        const entries = [];

        for await (const entry of zip.entries()) {
            entries.push(entry);
        }

        expect(entries.length).toBe(0);

        const res = await zip.extract(DESTINATION_FOLDER);
        expect(res.length).toBe(0);
    });

    it("Should return the same entries on multiple calls to entries()", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);

        const entries1 = [];
        for await (const entry of zip.entries()) {
            entries1.push(entry);
        }

        expect(entries1.length).toBe(5); // Basé sur le contenu de STANDARD_ZIP

        const entries2 = [];
        for await (const entry of zip.entries()) {
            entries2.push(entry);
        }

        expect(entries2.length).toBe(5);
        expect(entries2.map(e => e.fileName).sort()).toEqual(entries1.map(e => e.fileName).sort());
    });

    it("Should not be able to read entries after zip is closed", async () => {
        zip = await BsmZipExtractor.fromPath(STANDARD_ZIP);

        zip.close();

        await expect(zip.entries().next()).rejects.toThrow();
    });

    it("Should handle zip file from buffer", async () => {
        const zipBuffer = await readFile(STANDARD_ZIP);
        zip = await BsmZipExtractor.fromBuffer(zipBuffer);

        const entries = [];
        for await (const entry of zip.entries()) {
            entries.push(entry.fileName);
        }

        expect(entries.sort()).toEqual([
            "file_1.2.txt",
            "file_1.3.txt",
            "folder_1.1/",
            "folder_1.1/file_2.1.txt",
            "folder_1.1/file_2.2.txt",
        ].sort());
    });

    it("Should read and extract files with Unicode filenames", async () => {
        zip = await BsmZipExtractor.fromPath(UNICODE_ZIP);

        const entries = [];
        for await (const entry of zip.entries()) {
            entries.push(entry);
        }

        expect(entries.map(e => e.fileName)).toContain("こんにちは.txt"); // "Bonjour" en japonais

        const res = await zip.extract(DESTINATION_FOLDER);
        expect(res).toContain("こんにちは.txt");
        expect(pathExistsSync(path.join(DESTINATION_FOLDER, "こんにちは.txt")))
            .toBe(true);

    });

    it("Should throw an error when reading a corrupted zip file", async () => {
        const CORRUPTED_ZIP = path.join(TEST_FOLDER, "corrupted.zip");
        await expect(BsmZipExtractor.fromPath(CORRUPTED_ZIP)).rejects.toThrow(/.*[Error: Invalid comment length].*/)
    });
});
