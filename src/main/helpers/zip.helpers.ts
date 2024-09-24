import JSZip from "jszip";
import { pathExist } from "./fs.helpers";
import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";

export async function toZip(path: string): Promise<JSZip> {
    if (!(await pathExist(path))) {
        throw new Error(`Path ${path} does not exists`);
    }

    const data = await readFile(path);
    return JSZip.loadAsync(data);
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

export async function getFilenames(zip: JSZip): Promise<string[]> {
    const filenames: string[] = [];
    for (const [path, entry] of Object.entries(zip.files)) {
        if (!entry.dir) {
            filenames.push(path);
        }
    }
    return filenames;
}
