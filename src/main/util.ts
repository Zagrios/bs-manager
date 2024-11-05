/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { pathToFileURL, URL } from "url";
import path from "path";

export function resolveHtmlPath (htmlFileName: string) {
    if (process.env.NODE_ENV === "development") {
        const port = process.env.PORT || 1212;
        const url = new URL(`http://localhost:${port}/${htmlFileName}`);
        return url.toString();
    }

    const filePath = path.resolve(__dirname, "..", "renderer");
    return pathToFileURL(filePath).toString().concat("/", htmlFileName);
};


