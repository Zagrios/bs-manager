import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import yauzl from "yauzl";
import { FileHashes } from "shared/models/mods";
import { ensureFolderExist } from "./fs.helpers";

// NOTE: yauzl needs to be reopened when it is read

export async function extractZip(zipPath: string, destination: string): Promise<string[]> {
    await ensureFolderExist(destination);

    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, {
            lazyEntries: true,
            decodeStrings: true,
        },
        (openError, zip) => {
            if (openError) return reject(openError);
            handleExtractZip(zip, destination, resolve, reject);
        });
    });
}

function handleExtractZip(
    zip: yauzl.ZipFile, destination: string,
    resolve: (result: string[]) => void, reject: (error: any) => void
) {
    const files: string[] = [];

    zip.readEntry();

    zip.on("entry", (entry: yauzl.Entry) => {
        const absolutePath = path.join(destination, entry.fileName);

        // Entry is a directory / folder
        if (entry.fileName.endsWith("/")) {
            if (!fs.pathExistsSync(absolutePath)) {
                fs.mkdirSync(absolutePath, { recursive: true });
            }
            return zip.readEntry();
        }

        // Entry is a file
        zip.openReadStream(entry, (readError, readStream) => {
            if (readError) return reject(readError);

            // For forward slashes since they don't create directories
            const directory = path.dirname(absolutePath);
            if (!fs.pathExistsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            const writeStream = fs.createWriteStream(absolutePath);
            readStream.pipe(writeStream);

            readStream.on("end", () => zip.readEntry());
        });
    });

    zip.once("end", () => {
        zip.close();
        resolve(files);
    });
}

export function validateZip(zipPath: string, hashes: FileHashes[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, {
            lazyEntries: true,
            decodeStrings: true,
        },
        (openError, zip) => {
            if (openError) return reject(openError);
            handleValidateZip(zip, hashes, resolve, reject);
        });
    });
}

function handleValidateZip(
    zip: yauzl.ZipFile, hashes: FileHashes[],
    resolve: (result: boolean) => void, reject: (error: any) => void
) {
    let hashCount = 0;

    zip.readEntry();

    zip.on("entry", (entry: yauzl.Entry) => {
        // Entry is a directory / folder
        if (entry.fileName.endsWith("/")) {
            return zip.readEntry();
        }

        // Entry is a file
        zip.openReadStream(entry, (readError, readStream) => {
            if (readError) return reject(readError);

            const chunks: Buffer[] = [];
            readStream.on("data", data => {
                chunks.push(data);
            });

            readStream.on("end", () => {
                const md5Hash = crypto.createHash("md5")
                    .update(Buffer.concat(chunks))
                    .digest("hex");
                hashCount += +hashes.some(md5 => md5.hash === md5Hash);
                zip.readEntry();
            });
        });
    });

    zip.once("end", () => {
        zip.close();
        resolve(hashCount === hashes.length);
    });
}

