import JSZip from "jszip";
import fetch from "node-fetch";
import { CustomError } from "../../shared/models/exceptions/custom-error.class";
import { mkdirs, createWriteStream, pathExists } from "fs-extra";
import path from "path";
import { inflate } from "pako"
import { Observable, lastValueFrom } from "rxjs";
import { Progression, hashFile } from "../helpers/fs.helpers";

export class OculusDownloader {

    private options: OculusDownloaderOptions;
    private isDownloading: boolean;

    private getDownloadManifestUrl(token: string, binaryId: string): string {
        return `https://securecdn.oculus.com/binaries/download/?id=${binaryId}&access_token=${token}&get_manifest=1`;
    }

    private getDownloadSegmentUrl(token: string, binaryId: string, segmentSha256: string): string {
        return `https://securecdn.oculus.com/binaries/segment/?access_token=${token}&binary_id=${binaryId}&segment_sha256=${segmentSha256}`;
    }

    private async downloadManifestZip(manifestUrl: string): Promise<JSZip> {
        const response = await fetch(manifestUrl);
        const arrBuffer = await response.arrayBuffer();
        return JSZip.loadAsync(arrBuffer);
    }

    private async getManifest(): Promise<OculusManifest> {
        const downloadUrl = this.getDownloadManifestUrl(this.options.accessToken, this.options.binaryId);
        const manifestZip = await this.downloadManifestZip(downloadUrl).catch(err => CustomError.throw(err, "DOWNLOAD_MANIFEST_ZIP_FAILED"));
        const manifestFile = manifestZip.file("manifest.json");

        if(!manifestFile){
            throw new CustomError("Manifest file not found", "MANIFEST_FILE_NOT_FOUND");
        }

        return manifestFile.async("text").then(JSON.parse).catch(err => CustomError.throw(err, "PARSE_MANIFEST_FILE_FAILED"));
    }

    private async downloadManifestFile(file: OculusManifestFile, destination: string): Promise<OculusManifestFile> {
            
            const downloadSegment = async (segment: OculusManifestFileSegment): Promise<ArrayBuffer> => {
                const segmentUrl = this.getDownloadSegmentUrl(this.options.accessToken, this.options.binaryId, segment[1]);
                const response = await fetch(segmentUrl);
                return response.arrayBuffer();
            }
    
            await mkdirs(path.dirname(destination));
            const writeStream = createWriteStream(destination);
    
            for (const segment of file.segments) {
                const arrBuffer = await downloadSegment(segment);
                await writeStream.write(inflate(arrBuffer));
            }
            
            writeStream.close();

            return file;
    }

    private verifyIntegrity(manifest: OculusManifest, folder: string): Observable<Progression<OculusManifestFile[]>> {
        return new Observable<Progression<OculusManifestFile[]>>(sub => {

            const files = Object.entries(manifest.files);
            const progress: Progression<OculusManifestFile[]> = { current: 0, total: files.length, data: [] };
            const wrongFiles: OculusManifestFile[] = [];
            let canceled = false;

            (async () => {

                for(const [fileName, file] of files){

                    if(canceled){ return; }

                    const destination = path.join(folder, fileName);

                    if(!pathExists(destination)){
                        wrongFiles.push(file);
                        progress.current++;
                        sub.next(progress);
                        continue;
                    }

                    const fileSha256 = await hashFile(destination, "sha256");

                    if(fileSha256 !== file.sha256){
                        wrongFiles.push(file);
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
        });
    }

    public downloadApp(options: OculusDownloaderOptions): Observable<Progression>{

        return new Observable<Progression>(subscriber => {

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

                for(const file of files){

                    if(this.isDownloading === false){ return; }

                    const destination = path.join("C:", "test", "test", file[0]);
                    await this.downloadManifestFile(file[1], destination).catch(err => CustomError.throw(err, "DOWNLOAD_FILE_FAILED"));
                    progress.current += file[1].size;
                    subscriber.next(progress);
                }

                const integrity = await lastValueFrom(this.verifyIntegrity(manifest, path.join("C:", "test", "test"))).catch(err => CustomError.throw(err, "VERIFY_INTEGRITY_FAILED"));
                
                if(integrity.data.length > 0){
                    throw new CustomError("Some files failed to download", "SOME_FILES_FAILED_TO_DOWNLOAD", integrity.data);
                }

            })().then(() => subscriber.complete()).catch(err => subscriber.error(err));

            return () => {
                this.isDownloading = false;
            }
        });
    }

    public async verifyApp(options: OculusDownloaderOptions){
        throw new CustomError("Not implemented", "NOT_IMPLEMENTED");
    }

    public stopDownload(){
        this.isDownloading = false;
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

interface Logger {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}