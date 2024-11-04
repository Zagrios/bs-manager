import { FetchOptions, FetchService } from "./types";

async function send(method: "GET" | "POST", url: string, options?: FetchOptions) {
    try {
        const fetchOptions: any = { method };
        if (options?.headers) {
            fetchOptions.headers = options.headers;
        }

        if (options?.query) {
            url += "?"
            url += new URLSearchParams(options.query as any).toString();
        }

        if (options?.body) {
            fetchOptions.body = options.body;
        }

        const response = await fetch(url, fetchOptions);
        return {
            status: response.status,
            body: response.status < 300
                ? await response.json()
                : null,
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

export const fetchService = createFetchService();
