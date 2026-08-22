import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import ts from "typescript";

import paths from "../configs/paths";

const mainBundlePath = path.join(paths.appPath, "dist", "main", "main.js");
const appPackagePath = path.join(paths.appPath, "package.json");
const appPackage = JSON.parse(fs.readFileSync(appPackagePath, "utf8")) as {
    dependencies?: Record<string, string>;
};
const runtimeDependencies = new Set(Object.keys(appPackage.dependencies ?? {}));
const nodeModules = new Set(builtinModules.flatMap(moduleName => [moduleName, `node:${moduleName}`]));
const allowedModules = new Set([...nodeModules, "electron"]);
const externalModules = new Set<string>();

const getPackageName = (moduleName: string): string => {
    const parts = moduleName.split("/");
    return moduleName.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
};

const sourceFile = ts.createSourceFile(
    mainBundlePath,
    fs.readFileSync(mainBundlePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
);

const collectExternalRequires = (node: ts.Node): void => {
    if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "require" &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
    ) {
        const moduleName = node.arguments[0].text;
        if (!moduleName.startsWith(".") && !path.isAbsolute(moduleName) && !allowedModules.has(moduleName)) {
            externalModules.add(getPackageName(moduleName));
        }
    }

    ts.forEachChild(node, collectExternalRequires);
};

collectExternalRequires(sourceFile);

const undeclaredDependencies = [...externalModules]
    .filter(moduleName => !runtimeDependencies.has(moduleName))
    .sort();

if (undeclaredDependencies.length > 0) {
    throw new Error(
        `The main bundle requires undeclared runtime dependencies: ${undeclaredDependencies.join(", ")}. ` +
        "Add them to release/app/package.json."
    );
}

console.log(`Checked ${externalModules.size} external runtime dependencies in ${mainBundlePath}`);
