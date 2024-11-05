import { createWriteStream } from "fs";
import { Progression } from "main/helpers/fs.helpers";
import { Observable, shareReplay, tap } from "rxjs";
import log from "electron-log";
import got, { Options } from "got";
import { IncomingHttpHeaders, IncomingMessage } from "http";
import { unlinkSync } from "fs-extra";
import { tryit } from "shared/helpers/error.helpers";
import path from "path";
import { pipeline } from "stream/promises";
import sanitize from "sanitize-filename";

export class RequestService {
    private static instance: RequestService;

    public static getInstance(): RequestService {
        if (!RequestService.instance) {
            RequestService.instance = new RequestService();
        }
        return RequestService.instance;
    }

    private constructor() {}

    public getFilenameFromContentDisposition(disposition: string): string | undefined {

        if(!disposition) {
            return undefined;
        }

        const utf8FilenameRegex = /filename\*=UTF-8''([\w%\-\.]+)(?:; ?|$)/i;
        const asciiFilenameRegex = /^filename=(["']?)(.*?[^\\])\1(?:; ?|$)/i;

        const utf8Match = utf8FilenameRegex.exec(disposition);
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1]);
        }

        const filenameStart = disposition.toLowerCase().indexOf('filename=');

        if (filenameStart < 0) {
            return undefined;
        }

        const partialDisposition = disposition.slice(filenameStart);
        return asciiFilenameRegex.exec(partialDisposition)?.[2];
    }

    public async getJSON<T = unknown>(url: string): Promise<{ data: T, headers: IncomingHttpHeaders }> {

        try{
            const res = await got(url);
            return { data: JSON.parse(res.body), headers: res.headers };
        } catch (err) {
            log.error(err);
            throw err;
        }
    }

    public downloadFile(url: string, dest: string, opt?:{ preferContentDisposition?: boolean }): Observable<Progression<string>> {
        return new Observable<Progression<string>>(subscriber => {
            const progress: Progression<string> = { current: 0, total: 0 };

            const stream = got.stream(url)

            stream.on("response", response => {
                const filename = opt?.preferContentDisposition ? this.getFilenameFromContentDisposition(response.headers["content-disposition"]) : null;

                if (filename) {
                    dest = path.join(path.dirname(dest), sanitize(filename));
                }

                progress.data = dest;

                const file = createWriteStream(dest);

                pipeline(stream, file).catch(err => {
                    subscriber.error(err);
                });
            });

            stream.on("downloadProgress", ({ transferred, total }) => {
                progress.current = transferred;
                progress.total = total;
                subscriber.next(progress);
            });

            stream.on("error", err => {
                tryit(() => unlinkSync(dest));
                subscriber.error(err);
            });

            stream.on("end", () => {
                subscriber.next(progress);
                subscriber.complete();
            });

            return () => {
                stream.destroy();
            }

        }).pipe(tap({ error: e => log.error(e, url, dest) }), shareReplay(1));
    }

    public downloadBuffer(url: string, options?: Options & { isStream?: true }): Observable<Progression<Buffer, IncomingMessage>> {
        return new Observable<Progression<Buffer, IncomingMessage>>(subscriber => {
            const progress: Progression<Buffer, IncomingMessage> = {
                current: 0,
                total: 0,
                data: null,
            };

            const req = got.stream(url, options);

            let data = Buffer.alloc(0);
            let response: IncomingMessage;

            req.once("response", res => {
                response = res;
            });

            req.on("data", (chunk: Buffer) => {
                data = Buffer.concat([data, chunk]);
            })

            req.on("downloadProgress", ({ transferred, total }) => {
                progress.current = transferred;
                progress.total = total;
                subscriber.next(progress);
            });

            req.once("error", err => {
                subscriber.error(err);
            });

            req.once("end", () => {
                progress.data = data;
                progress.extra = response;
                subscriber.next(progress);
                subscriber.complete();
            });

            req.resume();

            return () => {
                req.destroy();
            }

        }).pipe(tap({ error: log.error }), shareReplay(1))
    }
}
