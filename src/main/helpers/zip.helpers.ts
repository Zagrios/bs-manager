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

const YAUZL_OPTIONS: yauzl.Options = {
    lazyEntries: true,
    decodeStrings: true,
};

function openZip(data: string | Buffer, callback: (error: Error, zip: yauzl.ZipFile) => void) {
    if (typeof data === "string") {
        yauzl.open(data, YAUZL_OPTIONS, callback);
    } else {
        yauzl.fromBuffer(data, YAUZL_OPTIONS, callback);
    }
}

export async function extractZip(
    data: string | Buffer,
    destination: string,
    options?: Readonly<ZipExtractOptions>
): Promise<string[]> {
    await ensureFolderExist(destination);

    return new Promise((resolve, reject) => {
        openZip(data, (openError: Error, zip: yauzl.ZipFile) => {
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
    let indexes: number[] = [];
    let dirname = "";

    options?.beforeFolderExtracted?.(".");
    const folderExtractEvents = options?.beforeFolderExtracted
        || options?.afterFolderExtracted
            ? (filename: string) => {
                let newDirname = path.dirname(filename);
                if (newDirname === ".") newDirname = "";

                const comparison = compareStringIndex(dirname, newDirname);
                if (comparison === -1) { return; }

                // Push after extraction
                if (options?.afterFolderExtracted) {
                    for (let i = indexes.length - 1; i > -1 && indexes[i] > comparison; --i) {
                        options.afterFolderExtracted(dirname.substring(0, indexes[i]));
                    }
                }

                // Push before extraction
                indexes = getSlashIndexes(newDirname);
                if (options?.beforeFolderExtracted) {
                    for (let i = 0; i < indexes.length; ++i) {
                        if (indexes[i] <= comparison) { continue; }
                        options.beforeFolderExtracted(newDirname.substring(0, indexes[i]));
                    }
                }

                dirname = newDirname;
            } : () => {};

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

            folderExtractEvents(entry.fileName);

            zipEntry.name = entry.fileName;
            zipEntry.directory = false;
            zipEntry.buffer = undefined;

            if (options?.terminate?.(zipEntry)) {
                readStream.destroy();
                zip.close();
                return resolve(files);
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
        if (options?.afterFolderExtracted) {
            // Push after extraction
            for (let i = indexes.length - 1; i > -1; --i) {
                options.afterFolderExtracted(dirname.substring(0, indexes[i]));
            }
            options.afterFolderExtracted(".");
        }

        zip.close();
        resolve(files);
    });
}

export function getFilesFromZip(
    data: string | Buffer,
    files: string[]
): Promise<Record<string, Buffer>> {
    return new Promise((resolve, reject) => {
        openZip(data, (openError: Error, zip: yauzl.ZipFile) => {
            if (openError) return reject(openError);
            handleGetFilesFromZip(zip, files, resolve, reject);
        });
    });
}

function handleGetFilesFromZip(
    zip: yauzl.ZipFile,
    files: string[],
    resolve: (buffers: Record<string, Buffer>) => void,
    reject: (error: Error) => void
) {
    const buffers: Record<string, Buffer> = {};
    let count = 0;

    zip.readEntry();

    zip.on("entry", (entry: yauzl.Entry) => {
        // Entry is a directory / folder
        if (entry.fileName.endsWith("/") || !files.includes(entry.fileName)) {
            return zip.readEntry();
        }

        // Entry is in the files list
        zip.openReadStream(entry, (readError, readStream) => {
            if (readError) return reject(readError);

            const chunks: Buffer[] = [];
            readStream.on("data", data => {
                chunks.push(data);
            });

            readStream.on("end", () => {
                buffers[entry.fileName] = Buffer.concat(chunks);

                ++count;
                if (count === files.length) {
                    zip.close();
                    return resolve(buffers);
                }

                zip.readEntry();
            });
        });
    });

    zip.once("end", () => {
        zip.close();
        resolve(buffers);
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
        openZip(data, (openError: Error, zip: yauzl.ZipFile) => {
            if (openError) return reject(openError);
            handleProcessZip<T>(
                zip, options, loop, initValue,
                resolve, reject
            );
        });
    });
}

function handleProcessZip<T>(
    zip: yauzl.ZipFile,
    options: Readonly<ZipProcessOptions>,
    loop: (accumulator: T, entry: ZipEntry) => T,
    accumulator: T,
    resolve: (result: T) => void, reject: (error: Error) => void
): void {
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
                return resolve(accumulator);
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

/**
 * @returns(number)
 *   -1 = string are the same
 *   > 0 = index where they don't equal the same
 */
function compareStringIndex(str1: string, str2: string) {
    const N = Math.min(str1.length, str2.length);
    let i = 0;
    for (; i < N; ++i) {
        if (str1[i] !== str2[i]) { break; }
    }

    return i === str1.length && i === str2.length
        ? -1 : i;
}

/**
 * @returns(number[]) - int array of the positions of the slashes
 */
function getSlashIndexes(str: string) {
    if (str === "") {
        return [];
    }

    const indexes: number[] = [];
    for (let i = 0; i < str.length; ++i) {
        if (str[i] === "/") {
            indexes.push(i);
        }
    }
    indexes.push(str.length);
    return indexes;
}

