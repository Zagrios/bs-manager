import { RequestOptions, get } from "https";
import { createWriteStream, unlink } from "fs";
import { Progression, unlinkPath } from "main/helpers/fs.helpers";
import { Observable, buffer, shareReplay, tap } from "rxjs";
import log from "electron-log";

export class RequestService {

    private static instance: RequestService;

    public static getInstance(): RequestService{
        if(!RequestService.instance){ RequestService.instance = new RequestService(); }
        return RequestService.instance;
    }

    private constructor(){}

    public get<T = any>(options: string|RequestOptions): Promise<T>{

        return new Promise((resolve, reject) => {
            let body = ''
            get(options, (res) => {
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    resolve(JSON.parse(body));
                });
                res.on('error', (err) => reject(err))
            }).on("error", err => reject(err));
        });
    }
    
    public downloadFile(url: string, dest: string): Observable<Progression<string>>{

        return new Observable<Progression<string>>(subscriber => {
            const progress: Progression<string> = { current: 0, total: 0 };

            const file = createWriteStream(dest);

            file.on("close", () => { 
                progress["data"] = dest;
                subscriber.next(progress); subscriber.complete(); 
            });
            file.on("error", err => unlink(dest, () => subscriber.error(err)));

            const req = get(url, res => {

                progress.total = parseInt(res.headers?.["content-length"] || "0", 10);

                res.on("data", chunk => {
                    progress.current += chunk.length;
                    subscriber.next(progress);
                });

                res.pipe(file);

            });

            req.on("error", err => { subscriber.error(err); });

        }).pipe(tap({error: e => log.error(e)}), shareReplay(1));
        
    }

    public downloadBuffer(url: string): Observable<Buffer>{

        return new Observable<Buffer>(subscriber => {
            const allChunks: Buffer[] = [];

            const req = get(url, res => {
                res.on("data", chunk => {
                    allChunks.push(chunk);
                });
                res.on('end', () => {
                    subscriber.next(Buffer.concat(allChunks));
                    subscriber.complete();
                });
                res.on('error', (err) => subscriber.error(err))
            });

            req.on("error", err => { subscriber.error(err); });

        }).pipe(tap({error: e => log.error(e)}), shareReplay(1));
    }

}