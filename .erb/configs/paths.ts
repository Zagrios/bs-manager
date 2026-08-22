import path from "node:path";

const rootPath = path.join(__dirname, "../..");
const erbPath = path.join(rootPath, ".erb");
const srcPath = path.join(rootPath, "src");
const releasePath = path.join(rootPath, "release");
const appPath = path.join(releasePath, "app");
const distPath = path.join(appPath, "dist");

export default {
    rootPath,
    erbNodeModulesPath: path.join(erbPath, "node_modules"),
    srcNodeModulesPath: path.join(srcPath, "node_modules"),
    appPath,
    appNodeModulesPath: path.join(appPath, "node_modules"),
    distPath,
    distMainPath: path.join(distPath, "main"),
    distRendererPath: path.join(distPath, "renderer"),
    buildPath: path.join(releasePath, "build"),
};
