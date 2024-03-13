import { Agent, RequestOptions, get } from "https";
import { createWriteStream, unlink } from "fs";
import { Progression } from "main/helpers/fs.helpers";
import { Observable, shareReplay, tap } from "rxjs";
import log from "electron-log";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import { app } from "electron";
import os from "os";

export class RequestService {
    private static instance: RequestService;

    public static getInstance(): RequestService {
        if (!RequestService.instance) {
            RequestService.instance = new RequestService();
        }
        return RequestService.instance;
    }

    private readonly defaultRequestInit: RequestInit;

    private constructor() {

        this.defaultRequestInit = {
            headers: {
                "User-Agent": `BSManager/${app.getVersion()} (${os.type()} ${os.release()})`
            },
            agent: new Agent({ family: 4 }),
        };
    }

    private getInitWithOptions(options?: RequestInit): RequestInit {
        return { ...this.defaultRequestInit, ...(options || {}) };
    }

    private requestOptionsFromDefaultInit(): RequestOptions {
        return {
            headers: this.defaultRequestInit.headers as Record<string, string>,
            agent: this.defaultRequestInit.agent as Agent,
        };
    }

    public async getJSON<T = unknown>(url: RequestInfo, options?: RequestInit): Promise<T> {

        try {
            const response = await fetch(url, this.getInitWithOptions(options));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${url}`);
            }

            return await response.json();
        } catch (err) {
            log.error(err);
            throw err;
        }
    }

    public downloadFile(url: string, dest: string): Observable<Progression<string>> {
        return new Observable<Progression<string>>(subscriber => {
            const progress: Progression<string> = { current: 0, total: 0 };

            const file = createWriteStream(dest);

            file.on("close", () => {
                progress.data = dest;
                subscriber.next(progress);
                subscriber.complete();
            });
            file.on("error", err => unlink(dest, () => subscriber.error(err)));

            const req = get(url, this.requestOptionsFromDefaultInit(), res => {
                progress.total = parseInt(res.headers?.["content-length"] || "0", 10);

                res.on("data", chunk => {
                    progress.current += chunk.length;
                    subscriber.next(progress);
                });

                res.pipe(file);
            });

            req.on("error", err => {
                subscriber.error(err);
            });
        }).pipe(tap({ error: e => log.error(e, url, dest) }), shareReplay(1));
    }

    public downloadBuffer(url: string): Observable<Progression<Buffer>> {
        return new Observable<Progression<Buffer>>(subscriber => {
            const progress: Progression<Buffer> = {
                current: 0,
                total: 0,
                data: null,
            };

            const allChunks: Buffer[] = [];

            const req = get(url, this.requestOptionsFromDefaultInit(), res => {
                progress.total = parseInt(res.headers?.["content-length"] || "0", 10);

                res.on("data", chunk => {
                    allChunks.push(chunk);
                    progress.current += chunk.length;
                    subscriber.next(progress);
                });
                res.on("end", () => {
                    progress.data = Buffer.concat(allChunks);
                    subscriber.next(progress);
                    subscriber.complete();
                });
                res.on("error", err => subscriber.error(err));
            });

            req.on("error", err => {
                subscriber.error(err);
            });
        }).pipe(tap({ error: e => log.error(e) }), shareReplay(1));
    }
}
