import { mkdir, pathExistsSync, realpath, rm, symlink, writeFile } from "fs-extra";
import { arePathsSameFileSystemLocation, getSize, resolveExistingFolder } from "main/helpers/fs.helpers";
import path from "path";

jest.mock("electron", () => ({ app: {
    getPath: () => "",
    getName: () => "",
}}));
jest.mock("electron-log", () => ({
    info: jest.fn(),
    error: jest.fn(),
}));

const TEST_FOLDER = path.resolve(__dirname, "..", "assets", "fs");

describe("arePathsSameFileSystemLocation", () => {
    beforeEach(async () => {
        await mkdir(TEST_FOLDER, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_FOLDER, { recursive: true, force: true });
    });

    it("recognizes an existing symlink or junction alias as the same location", async () => {
        const targetPath = path.join(TEST_FOLDER, "target");
        const aliasPath = path.join(TEST_FOLDER, "alias");
        await mkdir(targetPath);
        await symlink(targetPath, aliasPath, process.platform === "win32" ? "junction" : "dir");

        await expect(arePathsSameFileSystemLocation(targetPath, aliasPath)).resolves.toBe(true);
    });

    it("falls back to case-insensitive resolved paths on Windows when paths do not exist", async () => {
        const platformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
        Object.defineProperty(process, "platform", { value: "win32" });
        const missingPath = path.join(TEST_FOLDER, "Missing");

        try {
            await expect(arePathsSameFileSystemLocation(missingPath, missingPath.toUpperCase())).resolves.toBe(true);
        } finally {
            Object.defineProperty(process, "platform", platformDescriptor);
        }
    });
});

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

describe("resolveExistingFolder", () => {
    beforeEach(async () => {
        await mkdir(TEST_FOLDER, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_FOLDER, { recursive: true, force: true });
    });

    it("trims and resolves an existing folder path", async () => {
        await expect(resolveExistingFolder(` ${TEST_FOLDER} `)).resolves.toBe(await realpath(TEST_FOLDER));
    });

    it("returns the canonical target of an existing folder alias", async () => {
        const targetPath = path.join(TEST_FOLDER, "BSManager");
        const aliasPath = path.join(TEST_FOLDER, "alias");
        await mkdir(targetPath);
        await symlink(targetPath, aliasPath, process.platform === "win32" ? "junction" : "dir");

        await expect(resolveExistingFolder(aliasPath)).resolves.toBe(await realpath(targetPath));
    });

    it("rejects a folder path that does not exist", async () => {
        await expect(resolveExistingFolder(`${TEST_FOLDER}-missing`)).rejects.toMatchObject({ code: "INVALID_FOLDER" });
    });

    it("rejects a path to a file", async () => {
        const filePath = path.join(TEST_FOLDER, "file.txt");
        await writeFile(filePath, "content");

        await expect(resolveExistingFolder(filePath)).rejects.toMatchObject({ code: "INVALID_FOLDER" });
    });
});
