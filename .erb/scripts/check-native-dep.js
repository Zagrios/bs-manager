import fs from "fs";
import path from "path";
import chalk from "chalk";
import { dependencies } from "../../package.json";

if (dependencies) {
    const nativeDependencies = Object.keys(dependencies).filter(dependency => fs.existsSync(path.join("node_modules", dependency, "binding.gyp")));
    if (nativeDependencies.length === 0) {
        process.exit(0);
    }
    const plural = nativeDependencies.length > 1;
    console.log(`
 ${chalk.whiteBright.bgYellow.bold("Native runtime dependencies must stay in release/app.")}
${chalk.bold(nativeDependencies.join(", "))} ${plural ? "are native dependencies" : "is a native dependency"} and should be installed inside of the "./release/app" folder.
 First, uninstall the packages from "./package.json":
${chalk.whiteBright.bgGreen.bold("pnpm remove your-package")}
 ${chalk.bold('Then, instead of installing the package to the root "./package.json":')}
${chalk.whiteBright.bgRed.bold("pnpm add your-package")}
 ${chalk.bold('Install the package to "./release/app/package.json"')}
${chalk.whiteBright.bgGreen.bold("pnpm --dir ./release/app add your-package")}
 Vite leaves these dependencies external so Electron can load the rebuilt native binaries.
 `);
    process.exit(1);
}
