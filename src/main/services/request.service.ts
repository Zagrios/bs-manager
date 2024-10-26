import { Agent, RequestOptions, get } from "https";
import { createWriteStream } from "fs";
import { Progression, unlinkPath } from "../helpers/fs.helpers";
import { Observable, shareReplay, tap } from "rxjs";
import log from "electron-log";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import { app } from "electron";
import os from "os";
import path from "path";
import { tryit } from "../../shared/helpers/error.helpers";
import sanitize from "sanitize-filename";

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

    private getFilenameFromContentDisposition(disposition: string): string | null {

        if(!disposition) {
            return null;
        }

        const utf8FilenameRegex = /filename\*=UTF-8''([\w%\-\.]+)(?:; ?|$)/i;
        const asciiFilenameRegex = /^filename=(["']?)(.*?[^\\])\1(?:; ?|$)/i;

        const utf8Match = utf8FilenameRegex.exec(disposition);
        if (utf8Match) {
            return decodeURIComponent(utf8Match[1]);
        }

        const filenameStart = disposition.toLowerCase().indexOf('filename=');
        if (filenameStart >= 0) {
            const partialDisposition = disposition.slice(filenameStart);
            const asciiMatch = asciiFilenameRegex.exec(partialDisposition);
            if (asciiMatch && asciiMatch[2]) {
                return asciiMatch[2];
            }
        }

        return null;
    }

    public downloadFile(url: string, opt: { destFolder: string, filename: string, preferContentDisposition?: boolean }): Observable<Progression<string>> {
        return new Observable<Progression<string>>(subscriber => {
            const progress: Progression<string> = { current: 0, total: 0 };

            const req = get(url, this.requestOptionsFromDefaultInit(), res => {

                const filePath = (() => {
                    if(opt.preferContentDisposition && res.headers["content-disposition"]) {
                        const filename = this.getFilenameFromContentDisposition(res.headers["content-disposition"]);
                        return path.join(opt.destFolder, sanitize(filename || opt.filename));
                    }
                    return path.join(opt.destFolder, opt.filename);
                })();

                const file = createWriteStream(filePath);

                file.on("close", () => {
                    subscriber.next(progress);
                    subscriber.complete();
                });
                file.on("error", async err => {
                    log.error(err);
                    const res = await tryit(() => unlinkPath(filePath));
                    if(res.error) {
                        log.error(res.error);
                    }
                });

                progress.data = filePath;
                progress.total = parseInt(res.headers?.["content-length"] || "0", 10);

                subscriber.next(progress);

                res.on("data", chunk => {
                    progress.current += chunk.length;
                    subscriber.next(progress);
                });

                res.pipe(file);
            });

            req.on("error", err => {
                subscriber.error(err);
            });
        }).pipe(tap({ error: e => log.error(e, url) }), shareReplay(1));
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
