/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { pathToFileURL, URL } from "url";
import path from "path";

export function resolveHtmlPath (htmlFileName: string) {
    if (process.env.NODE_ENV === "development") {
        const rendererUrl = process.env.ELECTRON_RENDERER_URL ?? `http://localhost:${process.env.PORT || 1212}`;
        const url = new URL(htmlFileName, `${rendererUrl}/`);
        return url.toString();
    }

    const filePath = path.resolve(__dirname, "..", "renderer");
    return pathToFileURL(filePath).toString().concat("/", htmlFileName);
};
