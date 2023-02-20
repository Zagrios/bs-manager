import archiver from "archiver";
import { createWriteStream } from "fs";
import { Observable } from "rxjs";
import recursive from "recursive-readdir";
import { lstatSync } from "fs";
import * as _path from "path";
import { ArchiveProgress } from "shared/models/archive.interface";

export class Archive{

    private archive: archiver.Archiver;
    private readonly output: string;

    private readonly directories: string[] = [];
    private readonly files: string[] = [];

    constructor(output: string, options?: archiver.ArchiverOptions){
        this.output = output;
        this.initArchive(options);
    }

    private initArchive(options?: archiver.ArchiverOptions): void{
        const defaultOptions: archiver.ArchiverOptions = {
            zlib: {level: 9}
        };

        this.archive = archiver("zip", {...defaultOptions, ...options});
    }

    private async loadTotalFiles(): Promise<number>{
        let totalFiles = this.files.length;
        for(const path of this.directories){
            const files = await recursive(path);
            totalFiles += files.length;
        }
        return totalFiles;
    }

    public addDirectory(path: string, destPath?: string|false): void{
        this.directories.push(path);
        destPath = destPath === false ? false : _path.basename(path);
        this.archive.directory(path, destPath);
    }

    public addFile(path: string, destPath?: string): void{
        this.files.push(path);
        destPath = destPath ||= _path.basename(path);
        this.archive.file(path, {name: destPath});
    }


    public finalize(): Observable<ArchiveProgress>{

        const progress: ArchiveProgress = {
            totalFiles: 0,
            prossesedFiles: 0
        };
        
        return new Observable<ArchiveProgress>(observer => {
            (async () => {

                progress.totalFiles = await this.loadTotalFiles();

                this.archive.on("entry", e => {
                    if(e.stats.isDirectory()){ return; }
                    progress.prossesedFiles++;
                    observer.next(progress);
                });

                this.archive.pipe(createWriteStream(this.output));

                this.archive.on("error", err => observer.error(err));
                this.archive.finalize().then(() => observer.complete());
            })();
        });
    }

}