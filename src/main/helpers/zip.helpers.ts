import JSZip from "jszip";
import { pathExist } from "./fs.helpers";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { pathExistsSync } from "fs-extra";

// JSZip config defaults for now to avoid zip bombs
const MAX_FILES = 1_000;
const MAX_SIZE = 1024 * 1024 * 100; // 100MB


export async function processZip(
    // path to the zip or the JSZip object itself
    zip: string | JSZip,
    // Should return the number of bytes read
    handleFile: (relativePath: string, file: JSZip.JSZipObject) => Promise<number> | number
): Promise<void> {
    if (typeof zip === "string") {
        if (!pathExistsSync(zip)) {
            throw new Error(`Path ${zip} does not exists`);
        }

        const data = await readFile(zip);
        zip = await JSZip.loadAsync(data);
    }

    let fileCount = 0;
    let totalSize = 0;

    for (const [relativePath, file] of Object.entries(zip.files)) {
        ++fileCount;
        if (fileCount > MAX_FILES) {
            throw new Error(`Reached maximum number of files on "${zip}"`);
        }

        totalSize += await handleFile(relativePath, file);
        if (totalSize > MAX_SIZE) {
            throw new Error(`Reached maximum size on "${zip}"`);
        }
    }
}

export async function extractZip(zip: JSZip, dest: string): Promise<string[]> {
    if (!(await pathExist(dest))) {
        throw new Error(`Path ${dest} does not exist`);
    }
    const files: string[] = [];

    for (const [relativePath, entry] of Object.entries(zip.files)) {
        if (entry.dir) {
            continue;
        }

        const content = await entry.async("nodebuffer");
        const outPath = path.join(dest, relativePath);
        const outDir = path.dirname(outPath);

        await mkdir(outDir, { recursive: true });
        await writeFile(outPath, content);

        files.push(outPath);
    }

    return files;
}
