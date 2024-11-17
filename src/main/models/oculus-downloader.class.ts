import fetch from "node-fetch";
import { CustomError } from "../../shared/models/exceptions/custom-error.class";
import { mkdirs, createWriteStream, pathExists, WriteStream } from "fs-extra";
import path from "path";
import { inflate } from "pako"
import { EMPTY, Observable, ReplaySubject, Subscriber, catchError, filter, from, lastValueFrom, mergeMap, scan, share, tap } from "rxjs";
import { Progression, hashFile } from "../helpers/fs.helpers";
import { OculusDownloaderErrorCodes } from "../../shared/models/bs-version-download/oculus-download.model";
import { BsmZipExtractor } from "./bsm-zip-extractor.class";
import { tryit } from "shared/helpers/error.helpers";

export class OculusDownloader {

    private options: OculusDownloaderOptions;
    private isDownloading: boolean;

    private downloadSubscriber: Subscriber<Progression>;

    private getDownloadManifestUrl(token: string, binaryId: string): string {
        return `https://securecdn.oculus.com/binaries/download/?id=${binaryId}&access_token=${token}&get_manifest=1`;
    }

    private getDownloadSegmentUrl(token: string, binaryId: string, segmentSha256: string): string {
        return `https://securecdn.oculus.com/binaries/segment/?access_token=${token}&binary_id=${binaryId}&segment_sha256=${segmentSha256}`;
    }

    private async downloadManifestZip(manifestUrl: string): Promise<Buffer> {
        const response = await fetch(manifestUrl);
        const arrBuffer = await response.arrayBuffer();
        return Buffer.from(arrBuffer);
    }

    private async getManifest(): Promise<OculusManifest> {
        const downloadUrl = this.getDownloadManifestUrl(this.options.accessToken, this.options.binaryId);
        const buffer = await this.downloadManifestZip(downloadUrl)
            .catch(err => CustomError.throw(err, "DOWNLOAD_MANIFEST_FAILED"));

        const zip = await BsmZipExtractor.fromBuffer(buffer);
        const entry = await zip.getEntry("manifest.json");

        if(!entry) {
            throw new CustomError("Manifest file not found", "MANIFEST_FILE_NOT_FOUND");
        }

        const manifest = await entry.read();
        zip.close();

        const { result, error } = tryit(() => JSON.parse(manifest.toString()) as OculusManifest);

        if(error){
            throw CustomError.throw(error, "PARSE_MANIFEST_FILE_FAILED")
        }

        return result;
    }

    private downloadManifestFile(file: OculusManifestFile, destination: string): Observable<Progression<OculusManifestFile>> {

            const downloadSegment = async (segment: OculusManifestFileSegment): Promise<ArrayBuffer> => {
                const segmentUrl = this.getDownloadSegmentUrl(this.options.accessToken, this.options.binaryId, segment[1]);
                const response = await fetch(segmentUrl);
                return response.arrayBuffer();
            }

            const totalSegmentSize = file.segments.reduce((acc, segment) => acc + segment[2], 0);
            const progress: Progression<OculusManifestFile> = { current: 0, total: totalSegmentSize, diff: 0, data: file };

            return new Observable<Progression<OculusManifestFile>>(sub => {

                let canceled = false;
                let writeStream: WriteStream;

                (async () => {
                    await mkdirs(path.dirname(destination));
                    writeStream = createWriteStream(destination);

                    for (const segment of file.segments) {
                        if(canceled || !writeStream.writable || !this.isDownloading){ return; }

                        const arrBuffer = await downloadSegment(segment);
                        const inflated = inflate(arrBuffer);
                        writeStream.write(inflated);

                        progress.current += inflated.byteLength;
                        progress.diff = inflated.byteLength;

                        sub.next(progress);
                    }

                })().catch(err => sub.error(err)).finally(() => {
                    sub.complete();
                    writeStream?.end();
                });

                return () => {
                    canceled = true;
                    writeStream?.end();
                }
            });
    }

    private async isFileIntegrityValid(file: OculusFileWithName, folder: string): Promise<boolean> {
        const [fileName, fileData] = file;
        const destination = path.join(folder, fileName);

        return pathExists(destination).then(exists => {
            if(!exists){ return false; }
            return hashFile(destination, "sha256").then(hash => hash === fileData.sha256);
        });
    }

    private verifyIntegrity(manifest: OculusManifest, folder: string): Observable<Progression<OculusFileWithName[]>> {
        return new Observable<Progression<OculusFileWithName[]>>(sub => {

            const files = Object.entries(manifest.files);
            const progress: Progression<OculusFileWithName[]> = { current: 0, total: files.length, data: [] };
            const wrongFiles: OculusFileWithName[] = [];
            let canceled = false;

            (async () => {

                for(const oculusFile of files){

                    if(canceled){ return; }

                    if(!(await this.isFileIntegrityValid(oculusFile, folder))){
                        wrongFiles.push(oculusFile);
                    }

                    progress.current++;
                    sub.next(progress);
                }

                progress.data = wrongFiles;
                sub.next(progress);

            })().then(() => sub.complete()).catch(err => sub.error(err));

            return () => {
                canceled = true;
            }
        }).pipe(share({connector: () => new ReplaySubject(1)}));
    }

    public downloadApp(options: OculusDownloaderOptions): Observable<Progression>{

        return new Observable<Progression>(subscriber => {

            this.downloadSubscriber = subscriber;

            if(this.isDownloading){
                throw new CustomError("Already downloading", "ALREADY_DOWNLOADING");
            }

            this.options = options;
            this.isDownloading = true;

            const progress: Progression = { current: 0, total: 0 };

            (async () => {

                const manifest = await this.getManifest().catch(err => CustomError.throw(err, "UNABLE_TO_GET_MANIFEST"));
                const files = Object.entries(manifest.files);

                progress.total = files.reduce((acc, file) => { return acc + file[1].size }, 0)
                subscriber.next(progress);

                const filesDownloadObservable = from(files).pipe(
                    filter(() => this.isDownloading),
                    mergeMap(([filename, file]) => (
                        this.isFileIntegrityValid([filename, file], options.destination)).then(isValid => ({ filename, file, isValid })
                    )),
                    mergeMap(({ filename, file, isValid }) => {
                        if(isValid){
                            const res: Progression<OculusManifestFile> = { current: file.size, total: file.size, diff: file.size, data: file };
                            return from([res])
                        }

                        const target = path.join(options.destination, filename);
                        return this.downloadManifestFile(file, target).pipe(
                            catchError(err => {
                                this.options.logger?.error(err);
                                return EMPTY;
                            })
                        );
                    }, 15),
                    scan((acc, curr) => acc + curr.diff, 0),
                );

                await lastValueFrom(filesDownloadObservable.pipe(tap({
                    next: download => {
                        progress.current = download;
                        subscriber.next(progress);
                    },
                })));

                const integrity = await lastValueFrom(this.verifyIntegrity(manifest, options.destination)).catch(err => CustomError.throw(err, "VERIFY_INTEGRITY_FAILED"));

                if(integrity.data.length > 0){
                    throw new CustomError("Some files failed to download", "SOME_FILES_FAILED_TO_DOWNLOAD", integrity.data);
                }

            })().then(() => subscriber.complete()).catch(err => subscriber.error(err));

            return () => {
                this.isDownloading = false;
            }
        }).pipe(share({connector: () => new ReplaySubject(1)}));
    }

    public stopDownload(){
        this.isDownloading = false;
        this.downloadSubscriber?.error(CustomError.fromError(new Error("Download canceled"), OculusDownloaderErrorCodes.DOWNLOAD_CANCELLED));
    }

}

interface OculusDownloaderOptions {
    binaryId: Readonly<string>;
    accessToken: Readonly<string>;
    destination: Readonly<string>;
    logger?: Readonly<Logger>;
}

interface OculusManifest {
    appId: Readonly<string>;
    canonicalName: Readonly<string>;
    isCore: Readonly<boolean>;
    packageType: Readonly<string>;
    launchFile: Readonly<string>;
    launchParameters: Readonly<string>;
    launchFile2D: Readonly<string>;
    launchParameters2D: Readonly<string>;
    version: Readonly<string>;
    versionCode: Readonly<string>;
    redistributables: Readonly<unknown>;
    files: Readonly<Record<string, OculusManifestFile>>;
    firewallExceptionsRequired: Readonly<boolean>;
    parentCanonicalName: Readonly<string>;
    manifestVersion: Readonly<number>;
};

interface OculusManifestFile {
    sha256: Readonly<string>;
    size: number;
    segmentSize: number;
    segments: OculusManifestFileSegment[];
}

type OculusManifestFileSegment = [number, string, number];

type OculusFileWithName = [string, OculusManifestFile];

interface Logger {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}
