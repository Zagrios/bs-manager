import { ASSETS_FOLDER } from "__tests__/consts";
import { mkdir, pathExistsSync, rm, writeFile } from "fs-extra";
import { getSize } from "main/helpers/fs.helpers";
import path from "path";

jest.mock("electron", () => ({ app: {
    getPath: () => "",
    getName: () => "",
}}));
jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

const TEST_FOLDER = path.resolve(ASSETS_FOLDER, "fs");

describe("Test fs.helpers getSize", () => {

    beforeEach(async () => {
        if (pathExistsSync(TEST_FOLDER)) {
            await rm(TEST_FOLDER, { recursive: true, force: true });
        }
        await mkdir(TEST_FOLDER);
    });

    afterEach(async () => {
        await rm(TEST_FOLDER, { recursive: true, force: true });
    });

    it("should return 0 for empty folder", async () => {
        const size = await getSize(TEST_FOLDER);
        expect(size).toBe(0);
    });

    it("should throw error for non-existing folder", async () => {
        await expect(getSize(`${TEST_FOLDER}1`)).rejects.toThrow();
    });

    it("should return the total size of files in the directory", async () => {
        const filePath = path.join(TEST_FOLDER, "testFile.bin");
        const buffer = Buffer.alloc(10);

        await writeFile(filePath, buffer);

        const size = await getSize(TEST_FOLDER);
        expect(size).toBe(10);
    });

    it("should include the sizes of all files in the directory", async () => {
        const filePath1 = path.join(TEST_FOLDER, "testFile1.bin");
        const filePath2 = path.join(TEST_FOLDER, "testFile2.bin");
        const buffer = Buffer.alloc(10);

        await writeFile(filePath1, buffer);
        await writeFile(filePath2, buffer);

        const size = await getSize(TEST_FOLDER);
        expect(size).toBe(20);
    });

    it("should include the sizes of files in nested directories", async () => {
        const subFolder = path.join(TEST_FOLDER, "subFolder");
        const filePath1 = path.join(TEST_FOLDER, "testFile1.bin");
        const filePath2 = path.join(subFolder, "testFile2.bin");
        const buffer = Buffer.alloc(10);

        await mkdir(subFolder);

        await writeFile(filePath1, buffer);
        await writeFile(filePath2, buffer);

        const size = await getSize(TEST_FOLDER);
        expect(size).toBe(20);
    });

    it("should not include files beyond the default depth limit", async () => {
        const subFolder = path.join(TEST_FOLDER, "1", "2", "3", "4", "5");
        const filePath = path.join(subFolder, "testFile.bin");
        const buffer = Buffer.alloc(10);

        await mkdir(subFolder, { recursive: true });
        await writeFile(filePath, buffer);

        const size = await getSize(TEST_FOLDER);
        expect(size).toBe(0);
    });

    it("should include files within the specified depth limit", async () => {
        const subFolder = path.join(TEST_FOLDER, "1", "2", "3", "4", "5");
        const filePath = path.join(subFolder, "testFile.bin");
        const filePath2 = path.join(TEST_FOLDER, "1", "2", "testFile2.bin");
        const buffer = Buffer.alloc(10);

        await mkdir(subFolder, { recursive: true });
        await writeFile(filePath, buffer);
        await writeFile(filePath2, buffer);

        const size = await getSize(TEST_FOLDER, 6);
        expect(size).toBe(20);
    });

});
