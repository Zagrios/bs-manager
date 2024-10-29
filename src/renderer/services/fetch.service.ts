import { FetchOptions, FetchService } from "./types";

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
