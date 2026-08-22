import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import fs from "node:fs";
import path from "node:path";

const rootPath = import.meta.dirname;
const rendererPath = path.join(rootPath, "src", "renderer");
const distPath = path.join(rootPath, "release", "app", "dist");
const mainDistPath = path.join(distPath, "main");

const appPackage = JSON.parse(
    fs.readFileSync(path.join(rootPath, "release", "app", "package.json"), "utf8")
) as { dependencies?: Record<string, string> };

// release/app owns runtime dependencies. Keeping them external lets Electron load
// native addons from release/app/node_modules after electron-builder rebuilds them.
const runtimeDependencies = Object.keys(appPackage.dependencies ?? {});

const aliases = {
    main: path.join(rootPath, "src", "main"),
    renderer: rendererPath,
    shared: path.join(rootPath, "src", "shared"),
};

const defineEnvironment = {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "production"),
    "process.env.DEBUG_PROD": JSON.stringify(process.env.DEBUG_PROD ?? "false"),
};

const rendererPages = [
    "index.html",
    "launcher.html",
    "oneclick-download-map.html",
    "oneclick-download-playlist.html",
    "oneclick-download-model.html",
    "shortcut-launch.html",
];

export default defineConfig({
    main: {
        resolve: { alias: aliases },
        define: defineEnvironment,
        build: {
            outDir: mainDistPath,
            emptyOutDir: false,
            externalizeDeps: false,
            rollupOptions: {
                input: {
                    main: path.join(rootPath, "src", "main", "main.ts"),
                },
                external: runtimeDependencies,
                output: {
                    entryFileNames: "[name].js",
                },
            },
        },
    },
    preload: {
        resolve: { alias: aliases },
        define: defineEnvironment,
        build: {
            outDir: mainDistPath,
            emptyOutDir: false,
            externalizeDeps: false,
            rollupOptions: {
                input: {
                    preload: path.join(rootPath, "src", "main", "preload.ts"),
                },
                output: {
                    entryFileNames: "[name].js",
                },
            },
        },
    },
    renderer: {
        root: rendererPath,
        base: "./",
        resolve: { alias: aliases },
        define: defineEnvironment,
        plugins: [react()],
        server: {
            port: Number(process.env.PORT) || 1212,
            strictPort: true,
        },
        build: {
            outDir: path.join(distPath, "renderer"),
            emptyOutDir: false,
            rollupOptions: {
                input: Object.fromEntries(
                    rendererPages.map(page => [path.parse(page).name, path.join(rendererPath, page)])
                ),
            },
        },
    },
});
