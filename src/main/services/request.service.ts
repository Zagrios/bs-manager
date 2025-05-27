import { createWriteStream, WriteStream } from 'fs';
import { deleteFileSync, Progression } from 'main/helpers/fs.helpers';
import { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';
import log from 'electron-log';
import got from 'got';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { tryit } from 'shared/helpers/error.helpers';
import path from 'path';
import { pipeline } from 'stream/promises';
import sanitize from 'sanitize-filename';
import { app } from 'electron';
import { StaticConfigurationService } from './static-configuration.service';

export class RequestService {
    private static instance: RequestService;
    private readonly baseHeaders = {
        'User-Agent': `BSManager/${app.getVersion()} (Electron/${process.versions.electron} Chrome/${process.versions.chrome} Node/${process.versions.node})`,
    }

    private readonly config: StaticConfigurationService;

    public static getInstance(): RequestService {
        if (!RequestService.instance) {
            RequestService.instance = new RequestService();
        }
        return RequestService.instance;

    }

    private constructor() {
        this.config = StaticConfigurationService.getInstance();
    }

    public async getJSON<T = unknown>(url: string, options?: {
        silentError?: boolean
    }): Promise<{ data: T; headers: IncomingHttpHeaders }> {

        try {
            const family = this.config.get("force-ipv4") ? 4 : 6;
            const res = await got(url, {
                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                dnsLookupIpVersion: family,
                responseType: 'json',
                headers: this.baseHeaders,
            });
            return { data: res.body as T, headers: res.headers };
        } catch (err) {
            if (options?.silentError !== true) {
                log.error(`Failed to get JSON from URL: ${url}`, err);
            }
            throw err;
        }
    }

    public downloadFile(
        url: string,
        dest: string,
        opt?: { preferContentDisposition?: boolean }
    ): Observable<Progression<string>> {
        return new Observable<Progression<string>>((subscriber) => {
            const progress: Progression<string> = { current: 0, total: 0 };

            let file: WriteStream | undefined;

            // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
            const stream = got.stream(url, { headers: this.baseHeaders });

            stream.on('response', (response) => {

                const filename = opt?.preferContentDisposition ? this.getFilenameFromContentDisposition(response.headers['content-disposition']) : null;

                if (filename) {
                    dest = path.join(path.dirname(dest), sanitize(filename));
                }

                progress.data = dest;
                file = createWriteStream(dest);

                pipeline(stream, file).catch(err => {
                    file?.destroy();
                    tryit(() => deleteFileSync(dest));
                    subscriber.error(err);
                });
            });

            stream.on('downloadProgress', ({ transferred, total }) => {
                progress.current = transferred;
                progress.total = total;
                subscriber.next(progress);
            });

            stream.on('error', err => {
                log.error(`Download failed for URL: ${url}`, err);
                stream.destroy();
                file?.destroy();
            });

            stream.on('end', () => {
                file?.end();
                subscriber.next(progress);
                subscriber.complete();
            });

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

            const headers = { ...this.baseHeaders, ...(options?.headers ?? {}) };

            // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
            const stream = got.stream(url, { ...(options ?? {}), headers });

            let data = Buffer.alloc(0);
            let response: IncomingMessage;

            stream.once('response', (res) => {
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
                log.error(`Download failed for URL: ${url}`, err);
                stream.destroy();
            });

            stream.on('end', () => {
                progress.data = data;
                progress.extra = response;
                subscriber.next(progress);
                subscriber.complete();
            });

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
