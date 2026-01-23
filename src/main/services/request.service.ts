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
import internal from 'stream';
import { app, net } from 'electron';
import { CookieJar } from 'tough-cookie';

export class RequestService {
    private static instance: RequestService;
    private readonly baseHeaders = {
        'User-Agent': `BSManager/${app.getVersion()} (Electron/${process.versions.electron} Chrome/${process.versions.chrome} Node/${process.versions.node})`,
    }

    private readonly PREFERRED_FAMILY_TESTS = [4, 6];
    private preferredFamilyCache: Record<string, number> = {};

    public static getInstance(): RequestService {
        if (!RequestService.instance) {
            RequestService.instance = new RequestService();
        }
        return RequestService.instance;
    }

    private constructor() {}

    private isBeatmodsUrl(url: string): boolean {
        const { hostname } = new URL(url);
        return hostname === 'beatmods.com' || hostname.endsWith('.beatmods.com');
    }

    /**
     * Uses Electron's Chromium network stack instead of Node's HTTP stack
     * to avoid Cloudflare timeout issues that occur with beatmods.com
     */
    private async requestWithElectronNet<T = unknown>(url: string): Promise<{ data: T; headers: IncomingHttpHeaders }> {
        return new Promise<{ data: T; headers: IncomingHttpHeaders }>((resolve, reject) => {
            const request = net.request({
                method: 'GET',
                url,
                headers: this.baseHeaders,
            });

            let responseBody = Buffer.alloc(0);
            let responseHeaders: IncomingHttpHeaders = {};
            let isResolved = false;

            const timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    request.abort();
                    reject(new Error(`Request timeout for ${url}`));
                }
            }, 15000);

            const cleanup = () => {
                clearTimeout(timeoutId);
            };

            request.on('response', (response) => {
                responseHeaders = response.headers as IncomingHttpHeaders;

                // Validate HTTP status code (got throws on non-2xx by default)
                const { statusCode } = response;
                if (statusCode < 200 || statusCode >= 300) {
                    isResolved = true;
                    cleanup();
                    reject(new Error(`Request failed with status ${statusCode} for ${url}`));
                    return;
                }

                response.on('data', (chunk: Buffer) => {
                    responseBody = Buffer.concat([responseBody, chunk]);
                });

                response.on('end', () => {
                    if (isResolved) return;
                    isResolved = true;
                    cleanup();
                    try {
                        const bodyText = responseBody.toString('utf-8');
                        const data = JSON.parse(bodyText) as T;
                        resolve({ data, headers: responseHeaders });
                    } catch (parseError) {
                        reject(new Error(`Failed to parse JSON response from ${url}: ${parseError}`));
                    }
                });

                response.on('error', (error) => {
                    if (isResolved) return;
                    isResolved = true;
                    cleanup();
                    reject(new Error(`Response stream error for ${url}: ${error.message}`));
                });
            });

            request.on('error', (error) => {
                if (isResolved) return;
                isResolved = true;
                cleanup();
                reject(new Error(`Network error requesting ${url}: ${error.message}`));
            });

            request.end();
        });
    }

    public async getJSON<T = unknown>(url: string): Promise<{ data: T; headers: IncomingHttpHeaders }> {
        // Node's HTTP stack has Cloudflare compatibility issues with beatmods.com
        if (this.isBeatmodsUrl(url)) {
            return this.requestWithElectronNet<T>(url);
        }

        const domain = (new URL(url)).hostname;
        const cachedFamily = this.preferredFamilyCache[domain];
        if (cachedFamily) {
            try {
                return await this.requestData<T>(url, cachedFamily);
            } catch (error: any) {
                throw new Error(`Request failed: ${url}`, error);
            }
        }

        // Try on each IPv4/6 families on first request to a domain/website
        for (const family of this.PREFERRED_FAMILY_TESTS) {
            try {
                const response = await this.requestData<T>(url, family);
                log.info(`Caching "${domain}" with IPv${family}`);
                this.preferredFamilyCache[domain] = family;
                return response;
            } catch (err) {
                log.warn(`IPv${family} request failed, trying next one... URL: ${url}`, err);
            }
        }

        throw new Error(`IPv4 and IPv6 requests failed for URL: ${url}`);
    }

    private async requestData<T>(url: string, family: number): Promise<{ data: T; headers: IncomingHttpHeaders }> {

        const cookieJar = new CookieJar();

        const first = await got(url, {
            // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
            dnsLookupIpVersion: family,
            cookieJar,
            headers: this.baseHeaders
        });

        // Follow script redirect to get the JSON
        if (first.headers['content-type']?.includes('text/html')) {

            const cookieMatch = first.body.match(/document\.cookie="([^"]+)"/);
            if (!cookieMatch) {
                throw new Error("Cookie not found in JS");
            }

            const cookieString = cookieMatch[1];

            const redirectMatch = first.body.match(/location\.href="([^"]+)"/);
            if (!redirectMatch) {
                throw new Error("Redirect URL not found");
            }

            const jsonUrl = redirectMatch[1];
            await cookieJar.setCookie(cookieString, jsonUrl);

            const second = await got(jsonUrl, {
                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                dnsLookupIpVersion: family,
                responseType: "json",
                cookieJar,
                headers: this.baseHeaders
            });

            return {
                data: second.body as T,
                headers: second.headers
            };
        }

        return {
            data: JSON.parse(first.body) as T,
            headers: first.headers
        };
    }

    /**
     * Uses Electron's Chromium network stack instead of Node's HTTP stack
     * to avoid Cloudflare timeout issues that occur with beatmods.com
     */
    private downloadFileWithElectronNet(
        url: string,
        dest: string,
        opt?: { preferContentDisposition?: boolean }
    ): Observable<Progression<string>> {
        return new Observable<Progression<string>>((subscriber) => {
            const progress: Progression<string> = { current: 0, total: 0 };
            let file: WriteStream | undefined;
            let isCompleted = false;

            const request = net.request({
                method: 'GET',
                url,
                headers: this.baseHeaders,
            });

            const cleanup = () => {
                if (file) {
                    file.destroy();
                }
            };

            request.on('response', (response) => {
                // Validate HTTP status code (got throws on non-2xx by default)
                const { statusCode } = response;
                if (statusCode < 200 || statusCode >= 300) {
                    isCompleted = true;
                    cleanup();
                    subscriber.error(new Error(`Download failed with status ${statusCode} for ${url}`));
                    return;
                }

                const contentLength = response.headers['content-length'];
                if (contentLength) {
                    const length = Array.isArray(contentLength) ? contentLength[0] : contentLength;
                    progress.total = parseInt(length, 10);
                }

                const filename = opt?.preferContentDisposition
                    ? this.getFilenameFromContentDisposition(response.headers['content-disposition'] as string)
                    : null;

                if (filename) {
                    dest = path.join(path.dirname(dest), sanitize(filename));
                }

                progress.data = dest;
                file = createWriteStream(dest);

                file.on('error', (error) => {
                    cleanup();
                    tryit(() => deleteFileSync(dest));
                    if (!isCompleted) {
                        isCompleted = true;
                        subscriber.error(new Error(`File write error for ${dest}: ${error.message}`));
                    }
                });

                response.on('data', (chunk: Buffer) => {
                    if (file && !file.destroyed) {
                        progress.current += chunk.length;
                        subscriber.next(progress);
                        file.write(chunk);
                    }
                });

                response.on('end', () => {
                    if (isCompleted) return;
                    if (file && !file.destroyed) {
                        file.once('finish', () => {
                            if (isCompleted) return;
                            isCompleted = true;
                            subscriber.next(progress);
                            subscriber.complete();
                        });
                        file.end();
                    } else {
                        isCompleted = true;
                        subscriber.next(progress);
                        subscriber.complete();
                    }
                });

                response.on('error', (error) => {
                    if (isCompleted) return;
                    isCompleted = true;
                    cleanup();
                    tryit(() => deleteFileSync(dest));
                    subscriber.error(error);
                });
            });

            request.on('error', (error) => {
                if (isCompleted) return;
                isCompleted = true;
                cleanup();
                tryit(() => deleteFileSync(dest));
                subscriber.error(error);
            });

            request.end();

            return () => {
                request.abort();
                cleanup();
            };
        }).pipe(
            tap({ error: (e) => log.error(e, url, dest) }),
            shareReplay(1)
        );
    }

    public downloadFile(
        url: string,
        dest: string,
        opt?: { preferContentDisposition?: boolean }
    ): Observable<Progression<string>> {
        // Node's HTTP stack has Cloudflare compatibility issues with beatmods.com
        if (this.isBeatmodsUrl(url)) {
            return this.downloadFileWithElectronNet(url, dest, opt);
        }

        return new Observable<Progression<string>>((subscriber) => {
            const progress: Progression<string> = { current: 0, total: 0 };

            let attempt = 0;
            let stream: got.GotEmitter & internal.Duplex;

            const domain = (new URL(url)).hostname;
            const cachedFamily = this.preferredFamilyCache[domain];
            const familiesToTry = cachedFamily
                ? [ cachedFamily ] : this.PREFERRED_FAMILY_TESTS;

            const tryNextFamily = () => {
                if (attempt >= familiesToTry.length) {
                    subscriber.error(new Error(`Download failed over IPv4 and IPv6 for URL: ${url}`));
                    return;
                }

                const family = familiesToTry[attempt++];
                let file: WriteStream | undefined;

                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                stream = got.stream(url, { dnsLookupIpVersion: family, headers: this.baseHeaders });

                stream.on('response', (response) => {
                    if (!cachedFamily) {
                        log.info(`Caching "${domain}" with IPv${family}`);
                        this.preferredFamilyCache[domain] = family;
                    }

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

    /**
     * Uses Electron's Chromium network stack instead of Node's HTTP stack
     * to avoid Cloudflare timeout issues that occur with beatmods.com
     */
    private downloadBufferWithElectronNet(
        url: string,
        options?: got.GotOptions<null>
    ): Observable<Progression<Buffer, IncomingMessage>> {
        return new Observable<Progression<Buffer, IncomingMessage>>((subscriber) => {
            const progress: Progression<Buffer, IncomingMessage> = {
                current: 0,
                total: 0,
                data: null,
            };

            // Convert headers to the format expected by electron.net (string | string[])
            const electronHeaders: Record<string, string | string[]> = { ...this.baseHeaders };
            if (options?.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    if (typeof value === 'string' || Array.isArray(value)) {
                        electronHeaders[key] = value;
                    } else if (value != null) {
                        electronHeaders[key] = String(value);
                    }
                }
            }

            let data = Buffer.alloc(0);
            let responseHeaders: IncomingHttpHeaders = {};
            let isCompleted = false;

            const request = net.request({
                method: 'GET',
                url,
                headers: electronHeaders,
            });

            request.on('response', (response) => {
                // Validate HTTP status code (got throws on non-2xx by default)
                const { statusCode } = response;
                if (statusCode < 200 || statusCode >= 300) {
                    isCompleted = true;
                    subscriber.error(new Error(`Download failed with status ${statusCode} for ${url}`));
                    return;
                }

                const contentLength = response.headers['content-length'];
                if (contentLength) {
                    const length = Array.isArray(contentLength) ? contentLength[0] : contentLength;
                    progress.total = parseInt(length, 10);
                }

                responseHeaders = response.headers as IncomingHttpHeaders;

                response.on('data', (chunk: Buffer) => {
                    data = Buffer.concat([data, chunk]);
                    progress.current = data.length;
                    subscriber.next(progress);
                });

                response.on('end', () => {
                    if (isCompleted) return;
                    isCompleted = true;
                    progress.data = data;
                    // Required to maintain API compatibility with got-based implementation
                    const mockResponse = {
                        headers: responseHeaders,
                    } as IncomingMessage;
                    progress.extra = mockResponse;
                    subscriber.next(progress);
                    subscriber.complete();
                });

                response.on('error', (error) => {
                    if (isCompleted) return;
                    isCompleted = true;
                    subscriber.error(error);
                });
            });

            request.on('error', (error) => {
                if (isCompleted) return;
                isCompleted = true;
                subscriber.error(error);
            });

            request.end();

            return () => {
                request.abort();
            };
        }).pipe(
            tap({ error: (e) => log.error(e, url) }),
            shareReplay(1)
        );
    }

    public downloadBuffer(
        url: string,
        options?: got.GotOptions<null>
    ): Observable<Progression<Buffer, IncomingMessage>> {
        // Node's HTTP stack has Cloudflare compatibility issues with beatmods.com
        if (this.isBeatmodsUrl(url)) {
            return this.downloadBufferWithElectronNet(url, options);
        }

        return new Observable<Progression<Buffer, IncomingMessage>>((subscriber) => {
            const progress: Progression<Buffer, IncomingMessage> = {
                current: 0,
                total: 0,
                data: null,
            };

            const headers = { ...this.baseHeaders, ...(options?.headers ?? {}) };

            let attempt = 0;
            let stream: got.GotEmitter & internal.Duplex;

            const domain = (new URL(url)).hostname;
            const cachedFamily = this.preferredFamilyCache[domain];
            const familiesToTry = cachedFamily
                ? [ cachedFamily ] : this.PREFERRED_FAMILY_TESTS;

            const tryNextFamily = () => {
                if (attempt >= familiesToTry.length) {
                    subscriber.error(new Error(`Download failed over IPv4 and IPv6 for URL: ${url}`));
                    return;
                }

                const family = familiesToTry[attempt++];
                // @ts-ignore (ESM is not well supported in this project, We need to move out electron-react-boilerplate, and use Vite)
                stream = got.stream(url, { dnsLookupIpVersion: family, ...(options ?? {}), headers });

                let data = Buffer.alloc(0);
                let response: IncomingMessage;

                stream.once('response', (res) => {
                    if (!cachedFamily) {
                        log.info(`Caching "${domain}" with IPv${family}`);
                        this.preferredFamilyCache[domain] = family;
                    }
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
