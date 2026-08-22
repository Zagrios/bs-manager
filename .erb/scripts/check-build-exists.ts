// Check if the renderer and main bundles are built
import path from "path";
import chalk from "chalk";
import fs from "fs";
import paths from "../configs/paths";

const mainPath = path.join(paths.distMainPath, "main.js");
const rendererPath = path.join(paths.distRendererPath, "index.html");

if (!fs.existsSync(mainPath)) {
    throw new Error(chalk.whiteBright.bgRed.bold('The main process is not built yet. Build it by running "npm run build"'));
}

if (!fs.existsSync(rendererPath)) {
    throw new Error(chalk.whiteBright.bgRed.bold('The renderer process is not built yet. Build it by running "npm run build"'));
}
