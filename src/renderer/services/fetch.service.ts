export interface BsmResponse {
    status: number;
    body: any;
}

export interface FetchOptions {
    headers?: Record<string, string>;
    query?: Record<string, string | number | string[]>;
    body?: any;
}

export interface FetchService {
    get(url: string, options?: FetchOptions): Promise<BsmResponse>;
    post(url: string, options?: FetchOptions): Promise<BsmResponse>;
}

async function send(method: string, url: string, options?: FetchOptions) {
    try {
        const fetchOptions: any = { method };
        if (options?.headers) {
            fetchOptions.headers = options.headers;
        }
        if (options?.query) {
            // TODO:
        }
        if (options?.body) {
            fetchOptions.body = options.body;
        }

        const response = await fetch(url, fetchOptions);
        return {
            status: response.status,
            body: await response.json(),
        };
    } catch (error) {
        throw new Error(`[${method}] ${url} failed`, error);
    }
}

export function createFetchService(): FetchService {
    return {
        get(url, options) {
            return send("GET", url, options);
        },

        post(url, options) {
            return send("POST", url, options);
        },
    };
}

// TODO: Should be static somewhere
export const fetchService = createFetchService();
