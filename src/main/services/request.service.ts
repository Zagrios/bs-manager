import { Agent, RequestOptions, get } from "https";
import { createWriteStream, unlink } from "fs";
import { Progression } from "main/helpers/fs.helpers";
import { Observable, shareReplay, tap } from "rxjs";
import log from "electron-log";
import fetch, { RequestInfo, RequestInit } from "node-fetch";
import got, { Options } from "got";
import { IncomingMessage } from "http";
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

            return await response.json() as T;
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
