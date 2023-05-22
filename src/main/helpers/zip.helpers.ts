import JSZip from 'jszip';
import { pathExist } from './fs.helpers';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

export async function extractZip(zip: JSZip, dest: string): Promise<string[]>{
    if(!await pathExist(dest)){ throw new Error(`Path ${dest} does not exist`); }
    const files: string[] = [];
    await zip.forEach(async (relativePath, entry) => {
        if(entry.dir){ return; }

        const content = await entry.async("nodebuffer");
        const outPath = path.join(dest, relativePath);
        const outDir = path.dirname(outPath);

        await mkdir(outDir, { recursive: true });
        await writeFile(outPath, content);

        files.push(outPath);
    });

    return files;
}