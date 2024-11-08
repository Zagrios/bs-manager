import fs from "fs-extra";
import path from "path";
import yauzl from "yauzl";
import { ensureFolderExist } from "./fs.helpers";

// NOTE: yauzl needs to be reopened once readEntry is done

export interface ZipEntry {
    name: string;
    directory: boolean;
    buffer?: Buffer;
};

export interface ZipExtractOptions {
    // Stops the extraction immediately when set to true
    terminate?: (entry: ZipEntry) => boolean;
    // Whether or not to extract the file
    condition?: (entry: ZipEntry) => boolean;
    // Called before extracting the folder
    beforeFolderExtracted?: (folder: string) => void;
    // Called when the folder contents is fully extracted
    afterFolderExtracted?: (folder: string) => void;
};

export interface ZipProcessOptions {
    // Stops the extraction immediately when set to true
    terminate?: (entry: ZipEntry) => boolean;
    getBuffer?: boolean;
};

export async function extractZip(
    zipPath: string,
    destination: string,
    options?: Readonly<ZipExtractOptions>
): Promise<string[]> {
    await ensureFolderExist(destination);

    return new Promise((resolve, reject) => {
        yauzl.open(zipPath, {
            lazyEntries: true,
            decodeStrings: true,
        },
        (openError, zip) => {
            if (openError) return reject(openError);
            handleExtractZip(zip, destination, options, resolve, reject);
        });
    });
}

function handleExtractZip(
    zip: yauzl.ZipFile,
    destination: string,
    options: Readonly<ZipExtractOptions> | undefined,
    resolve: (result: string[]) => void, reject: (error: Error) => void
) {
    const files: string[] = [];
    const zipEntry: ZipEntry = {
        name: "",
        directory: false,
    };
    let currentDirname = "";

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

            const dirname = path.dirname(entry.fileName);
            if (dirname !== currentDirname) {
                if (path.dirname(dirname) === path.dirname(currentDirname)) {
                    options?.afterFolderExtracted?.(currentDirname);
                    options?.beforeFolderExtracted?.(dirname);
                } else if (currentDirname.startsWith(dirname)) {
                    options?.afterFolderExtracted?.(currentDirname);
                } else if (dirname.startsWith(currentDirname)) {
                    options?.beforeFolderExtracted?.(dirname);
                } else {
                    options?.afterFolderExtracted?.(currentDirname);
                    options?.beforeFolderExtracted?.(dirname);
                }
                currentDirname = dirname;
            }

            zipEntry.name = entry.fileName;
            zipEntry.directory = false;
            zipEntry.buffer = undefined;

            if (options?.terminate?.(zipEntry)) {
                readStream.destroy();
                return zip.close();
            }

            if (options?.condition) {
                if (!options.condition(zipEntry)) {
                    readStream.destroy();
                    return zip.readEntry();
                }
            }

            // For forward slashes since they don't create directories
            const directory = path.dirname(absolutePath);
            if (!fs.pathExistsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }

            const writeStream = fs.createWriteStream(absolutePath);
            readStream.pipe(writeStream);
            readStream.on("end", () => {
                zip.readEntry()
            });
        });
    });

    zip.once("end", () => {
        options?.afterFolderExtracted?.(currentDirname);
        zip.close();
        resolve(files);
    });
}

// @params loop - this should not throw an error
export function processZip<T>(
    data: string | Buffer,
    options: Readonly<ZipProcessOptions>,
    loop: (accumulator: T, entry: ZipEntry) => T,
    initValue: T
): Promise<T> {
    return new Promise((resolve, reject) => {
        const callback = (openError: Error, zip: yauzl.ZipFile) => {
            if (openError) return reject(openError);
            handleProcessZip<T>(
                zip, options, loop, initValue,
                resolve, reject
            );
        }

        if (typeof data === "string") {
            yauzl.open(data, {
                lazyEntries: true,
                decodeStrings: true,
            }, callback);
        } else {
            yauzl.fromBuffer(data, callback);
        }
    });
}

async function handleProcessZip<T>(
    zip: yauzl.ZipFile,
    options: Readonly<ZipProcessOptions>,
    loop: (accumulator: T, entry: ZipEntry) => T,
    accumulator: T,
    resolve: (result: T) => void, reject: (error: Error) => void
): Promise<void> {
    const zipEntry: ZipEntry = {
        name: "",
        directory: false,
    };

    zip.readEntry();

    zip.on("entry", (entry: yauzl.Entry) => {
        const isDirectory = entry.fileName.endsWith("/");
        if (isDirectory || !options.getBuffer) {
            zipEntry.name = entry.fileName;
            zipEntry.directory = isDirectory;
            zipEntry.buffer = undefined;
            accumulator = loop(accumulator, zipEntry);
            return zip.readEntry();
        }

        // Entry is a file
        zip.openReadStream(entry, (readError, readStream) => {
            if (readError) return reject(readError);

            zipEntry.name = entry.fileName;
            zipEntry.directory = false;
            zipEntry.buffer = undefined;
            if (options?.terminate?.(zipEntry)) {
                readStream.destroy();
                zip.close();
                return;
            }

            const chunks: Buffer[] = [];
            readStream.on("data", data => {
                chunks.push(data);
            });

            readStream.on("end", () => {
                zipEntry.buffer = Buffer.concat(chunks);
                accumulator = loop(accumulator, zipEntry);
                zip.readEntry();
            });
        });
    });

    zip.once("end", () => {
        zip.close();
        resolve(accumulator);
    });
}

