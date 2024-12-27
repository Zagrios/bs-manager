import { createWriteStream, WriteStream } from 'fs';
import { Progression } from 'main/helpers/fs.helpers';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import log from 'electron-log';
import got from 'got';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { unlinkSync } from 'fs-extra';
import { tryit } from 'shared/helpers/error.helpers';
import path from 'path';
import { pipeline } from 'stream/promises';
import sanitize from 'sanitize-filename';
import internal from 'stream';

export class RequestService {
    private static instance: RequestService;
    private preferredFamily: number | undefined = undefined;

    public static getInstance(): RequestService {
        if (!RequestService.instance) {
            RequestService.instance = new RequestService();
        }
        return RequestService.instance;
    }

    private constructor() {}

    public async getJSON<T = unknown>(url: string): Promise<{ data: T; headers: IncomingHttpHeaders }> {

        const familiesToTry = this.preferredFamily ? [this.preferredFamily, this.preferredFamily === 4 ? 6 : 4] : [4, 6];

        for (const family of familiesToTry) {
            try {

                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                const res = await got(url, { dnsLookupIpVersion: family, responseType: 'json' });
                this.preferredFamily = family;
                return { data: res.body as T, headers: res.headers };
            } catch (err) {
                log.warn(`IPv${family} request failed, trying next one... URL: ${url}`, err);
            }
        }

        log.error(`IPv4 and IPv6 requests failed for URL: ${url}`);
        this.preferredFamily = undefined;
        throw new Error(`IPv4 and IPv6 requests failed for URL: ${url}`);
    }

    public downloadFile(
        url: string,
        dest: string,
        opt?: { preferContentDisposition?: boolean }
    ): Observable<Progression<string>> {
        return new Observable<Progression<string>>((subscriber) => {
            const progress: Progression<string> = { current: 0, total: 0 };
            const familiesToTry = this.preferredFamily ? [this.preferredFamily, this.preferredFamily === 4 ? 6 : 4] : [4, 6];

            let attempt = 0;
            let stream: got.GotEmitter & internal.Duplex;

            const tryNextFamily = () => {
                if (attempt >= familiesToTry.length) {
                    subscriber.error(new Error(`Download failed over IPv4 and IPv6 for URL: ${url}`));
                    return;
                }

                const family = familiesToTry[attempt++];
                let file: WriteStream | undefined;

                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                stream = got.stream(url, { dnsLookupIpVersion: family });

                stream.on('response', (response) => {
                    this.preferredFamily = family;

                    const filename = opt?.preferContentDisposition ? this.getFilenameFromContentDisposition(response.headers['content-disposition']) : null;

                    if (filename) {
                        dest = path.join(path.dirname(dest), sanitize(filename));
                    }

                    progress.data = dest;
                    file = createWriteStream(dest);

                    pipeline(stream, file).catch(err => {
                        file?.destroy();
                        tryit(() => unlinkSync(dest));
                        subscriber.error(err);
                    });
                });

                stream.on('downloadProgress', ({ transferred, total }) => {
                    progress.current = transferred;
                    progress.total = total;
                    subscriber.next(progress);
                });

                stream.on('error', err => {
                    log.warn(`Download failed over IPv${family} for URL: ${url}`, err);
                    stream.destroy();
                    file?.destroy();
                    tryNextFamily();
                });

                stream.on('end', () => {
                    file?.end();
                    subscriber.next(progress);
                    subscriber.complete();
                });
            };

            tryNextFamily();

            return () => {
                stream?.destroy();
            };
        }).pipe(
            tap({ error: (e) => log.error(e, url, dest) }),
            shareReplay(1)
        );
    }

    public downloadBuffer(
        url: string,
        options?: got.GotOptions<null>
    ): Observable<Progression<Buffer, IncomingMessage>> {
        return new Observable<Progression<Buffer, IncomingMessage>>((subscriber) => {
            const progress: Progression<Buffer, IncomingMessage> = {
                current: 0,
                total: 0,
                data: null,
            };

            const familiesToTry = this.preferredFamily ? [this.preferredFamily, this.preferredFamily === 4 ? 6 : 4] : [4, 6];

            let attempt = 0;
            let stream: got.GotEmitter & internal.Duplex;

            const tryNextFamily = () => {
                if (attempt >= familiesToTry.length) {
                    subscriber.error(new Error(`Download failed over IPv4 and IPv6 for URL: ${url}`));
                    return;
                }

                const family = familiesToTry[attempt++];

                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                stream = got.stream(url, { dnsLookupIpVersion: family, ...(options ?? {}) });

                let data = Buffer.alloc(0);
                let response: IncomingMessage;

                stream.once('response', (res) => {
                    this.preferredFamily = family;
                    response = res;
                });

                stream.on('data', (chunk: Buffer) => {
                    data = Buffer.concat([data, chunk]);
                });

                stream.on('downloadProgress', ({ transferred, total }) => {
                    progress.current = transferred;
                    progress.total = total;
                    subscriber.next(progress);
                });

                stream.on('error', err => {
                    log.warn(`Download failed over IPv${family} for URL: ${url}`, err);
                    stream.destroy();
                    tryNextFamily();
                });

                stream.on('end', () => {
                    progress.data = data;
                    progress.extra = response;
                    subscriber.next(progress);
                    subscriber.complete();
                });
            };

            tryNextFamily();

            return () => {
                stream?.destroy();
            };
        }).pipe(
            tap({ error: (e) => log.error(e, url) }),
            shareReplay(1)
        );
    }

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
}
