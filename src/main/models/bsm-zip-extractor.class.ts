import { createWriteStream, ensureDir } from "fs-extra";
import path from "path";
import { Readable } from "stream";
import yauzl, { ZipFile, Options, Entry } from "yauzl"

export class BsmZipExtractor {

    private static readonly YAUZL_OPEN_OPTIONS: Options = {
        lazyEntries: true,
        decodeStrings: true,
        autoClose: false,
    };

    public static fromPath(path: string): Promise<BsmZipExtractor> {
        return new Promise((resolve, reject) => {
            yauzl.open(path, BsmZipExtractor.YAUZL_OPEN_OPTIONS, (error: Error, zip: yauzl.ZipFile) => {
                if (error) return reject(error);
                resolve(new BsmZipExtractor(zip));
            });
        });
    }

    public static fromBuffer(buffer: Buffer): Promise<BsmZipExtractor> {
        return new Promise((resolve, reject) => {
            yauzl.fromBuffer(buffer, BsmZipExtractor.YAUZL_OPEN_OPTIONS, (error: Error, zip: yauzl.ZipFile) => {
                if (error) return reject(error);
                resolve(new BsmZipExtractor(zip));
            });
        });
    }

    private readonly zip: ZipFile;
    private readonly entriesMap = new Map<string, BsmZipExtractorEntry>();

    private constructor(zip: ZipFile) {
        this.zip = zip;
    }

    private async readEntry(): Promise<BsmZipExtractorEntry> {
        return new Promise((resolve, reject) => {
            const onEntry = (entry: Entry) => {
                cleanup();
                resolve(new BsmZipExtractorEntry({ entry, zip: this.zip }));
            };

            const onEnd = () => {
                cleanup();
                resolve(null);
            };

            const onError = (err: Error) => {
                cleanup();
                reject(err);
            };

            const cleanup = () => {
                this.zip.removeListener("entry", onEntry);
                this.zip.removeListener("end", onEnd);
                this.zip.removeListener("error", onError);
            };

            this.zip.once("entry", onEntry);
            this.zip.once("end", onEnd);
            this.zip.once("error", onError);
            this.zip.readEntry();
        });
    }

    // The first time this method is called, it will read all the entries and store them in a map
    // The next times it will return the entries from the map to avoid reopening the zip file again
    public async *entries(): AsyncGenerator<BsmZipExtractorEntry> {

        for (const entry of Array.from(this.entriesMap.values())) {
            yield entry;
        }

        let entry: BsmZipExtractorEntry = await this.readEntry();
        while (entry) {
            this.entriesMap.set(entry.fileName, entry);
            yield entry;
            entry = await this.readEntry();
        }
    }

    public async findEntry(func: (entry: BsmZipExtractorEntry) => boolean): Promise<BsmZipExtractorEntry|null> {
        for await (const entry of this.entries()) {
            if (func(entry)) {
                return entry;
            }
        }
        return null;
    }

    public async filterEntries(func: (entry: BsmZipExtractorEntry) => boolean): Promise<BsmZipExtractorEntry[]> {
        const filtered: BsmZipExtractorEntry[] = [];
        for await (const entry of this.entries()) {
            if (func(entry)) {
                filtered.push(entry);
            }
        }
        return filtered;
    }

    public async getEntry(fileName: string): Promise<BsmZipExtractorEntry> {
        return this.entriesMap.get(fileName) ?? this.findEntry(entry => entry.fileName === fileName);
    }

    /**
     * Extracts all entries from the zip file to the destination folder
     * @param destination
     * @param opt - { entriesNames?: string[], abortToken: AbortController }
     * @returns {Promise<string[]>} The list of extracted files (relative paths in the destination folder)
     *
     * `opt` object:
     *   - `entriesNames` - The list of entries to extract (can be regexs or glob pattern). If not provided, all entries will be extracted
     *   - `abortToken` - The AbortController instance to abort the extraction
     *
     */
    public async extract(destination: string, opt?: { entriesNames?: (string|RegExp)[], abortToken?: AbortController }): Promise<string[]> {
        const entriesNames = opt?.entriesNames;
        const abortToken = opt?.abortToken;

        if (abortToken?.signal?.aborted) {
            return [];
        }

        await ensureDir(destination);

        const extracted = new Set<string>()
        for await (const entry of this.entries()) {

            if (abortToken?.signal?.aborted) {
                break;
            }

            if (entriesNames && !entriesNames.some(name => typeof name === "string" ? (entry.fileName === name || path.matchesGlob(entry.fileName, name)) : name.test(entry.fileName))){
                continue;
            }

            const extractedFile = await entry.extract(destination);
            const dirname = path.dirname(extractedFile);

            // Make zip that use backslash as separator have the same behavior as zip that use forward slash
            if(dirname !== "."){
                const split = dirname.split(path.posix.sep);
                for (let i = 1; i <= split.length; i++) {
                    const folder = split.slice(0, i).join(path.posix.sep);
                    extracted.add(folder + path.posix.sep);
                }
            }


            extracted.add(extractedFile);
        }

        return Array.from(extracted);
    }


    public close(): void {
        this.zip.close();
    }

}

class BsmZipExtractorEntry {

    private readonly entry: Entry;
    private readonly zip: ZipFile;

    constructor(opt: { entry: Entry, zip: ZipFile }) {
        this.entry = opt.entry;
        this.zip = opt.zip;
    }

    public async read(): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            this.zip.openReadStream(this.entry, (error: Error, stream: Readable) => {
                if (error) return reject(error);
                const buffers: Buffer[] = [];
                stream.on("data", (data) => buffers.push(data as Buffer));
                stream.on("end", () => resolve(Buffer.concat(buffers)));
                stream.on("error", reject);
            });
        });
    }

    public async extract(destination: string): Promise<string> {

        const destPath = path.join(destination, this.entry.fileName);

        if (this.isDirectory) {
            return ensureDir(destPath).then(() => this.entry.fileName);
        }

        return new Promise((resolve, reject) => {
            this.zip.openReadStream(this.entry, async (error: Error, stream: Readable) => {
                if (error) return reject(error);

                await ensureDir(path.dirname(destPath));

                const writeStream = createWriteStream(destPath);
                stream.pipe(writeStream);
                writeStream.on("finish", () => resolve(this.entry.fileName));
                writeStream.on("error", reject);
            });
        });
    }

    public get isDirectory(): boolean {
        return this.entry.fileName.endsWith("/");
    }

    public get fileName(): string {
        return this.entry.fileName;
    }

}
