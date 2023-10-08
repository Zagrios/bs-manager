/**
* Code taken from https://github.com/kubeshop/monokle/blob/main/tests/electronHelpers.ts
* don't tunch unless you know what you're doing
*/

import { Page } from "@playwright/test";
import path from "path";
import {ElectronApplication, _electron as electron} from 'playwright-core';
import { pause } from "shared/helpers/promise.helpers";
import log from "electron-log";
import * as fs from 'fs';
import * as ASAR from 'asar';

export const TEST_OUTPUT_DIR = 'test-results';

export async function startApp(): Promise<StartAppResponse> {
    const latestBuild = findLatestBuild();
    const appInfo = parseElectronApp(latestBuild);
    const electronApp = await electron.launch({
        args: [appInfo.main],
        executablePath: appInfo.executable,
        recordVideo: {
            dir: getRecordingPath(appInfo.platform),
            size: {
                width: 1920,
                height: 1080,
            },
        },
    });
  
    await electronApp.firstWindow();

    // wait for auto-updater to pass
    let appWindow: Page;
    while (!appWindow) {    
        appWindow = getMainWindow(electronApp.windows());
        await pause(500);
    }

    if (!appWindow) {
        throw new Error('Unable to get main window');
    }

    await pause(4000);

    appWindow.on('console', log.info);
    appWindow.screenshot({path: path.join(TEST_OUTPUT_DIR, "initial-screen.png")});
  
    return {appWindow, appInfo, electronApp};
}

export function findLatestBuild(): string {
    const rootDir = path.resolve('./');
    const outDir = path.join(rootDir, 'release', 'build');
    const builds = fs.readdirSync(outDir);
    const platforms = ['win32', 'win', 'windows', 'darwin', 'mac', 'macos', 'osx', 'linux', 'ubuntu'];
  
    const latestBuild = builds
        .map(fileName => {
            // make sure it's a directory with "-" delimited platform in its name
            const stats = fs.statSync(path.join(outDir, fileName));
            const isBuild = fileName.toLocaleLowerCase().split('-').some(part => platforms.includes(part));

            if(!stats.isDirectory() || !isBuild){ return undefined; }

            return {
                name: fileName,
                time: fs.statSync(path.join(outDir, fileName)).mtimeMs,
            };
        })
        .sort((a, b) => b.time - a.time)
        .map(file => file?.name)[0];

    if (!latestBuild) {
        throw new Error('No build found in out directory');
    }
    
    return path.join(outDir, latestBuild);
}

/**
 * Given a directory containing an Electron app build,
 * return the path to the app's executable and the path to the app's main file.
 */
export function parseElectronApp(buildDir: string): ElectronAppInfo {
    log.info(`Parsing Electron app in ${buildDir}`);

    let platform: string | undefined;

    if (buildDir.endsWith('.app')) {
        buildDir = path.dirname(buildDir);
        platform = 'darwin';
    }
    else if (buildDir.endsWith('.exe')) {
        buildDir = path.dirname(buildDir);
        platform = 'win32';
    }
  
    const baseName = path.basename(buildDir).toLowerCase();
    if (!platform) {
        // parse the directory name to figure out the platform
        if (baseName.includes('win')) {
            platform = 'win32';
        }
        if (baseName.includes('linux') || baseName.includes('ubuntu') || baseName.includes('debian')) {
            platform = 'linux';
        }
        if (baseName.includes('darwin') || baseName.includes('mac') || baseName.includes('osx')) {
            platform = 'darwin';
        }
    }
  
    if (!platform) {
        throw new Error(`Platform not found in directory name: ${baseName}`);
    }
  
    let arch: Architecture;
    if (baseName.includes('x32') || baseName.includes('i386')) {
        arch = 'x32';
    }
    if (baseName.includes('x64')) {
        arch = 'x64';
    }
    if (baseName.includes('arm64')) {
        arch = 'arm64';
    }
  
    let executable: string;
    let main: string;
    let name: string;
    let asar: boolean;
    let resourcesDir: string;
  
    if (platform === 'darwin') {
      // MacOS Structure
      // <buildDir>/
      //   <appName>.app/
      //     Contents/
      //       MacOS/
      //        <appName> (executable)
      //       Info.plist
      //       PkgInfo
      //       Resources/
      //         electron.icns
      //         file.icns
      //         app.asar (asar bundle) - or -
      //         app
      //           package.json
      //           (your app structure)
  
        const list = fs.readdirSync(buildDir);
        const appBundle = list.find(fileName => {
            return fileName.endsWith('.app');
        });

        const appDir = path.join(buildDir, appBundle, 'Contents', 'MacOS');
        const appName = fs.readdirSync(appDir)[0];
        executable = path.join(appDir, appName);
  
        resourcesDir = path.join(buildDir, appBundle, 'Contents', 'Resources');
        const resourcesList = fs.readdirSync(resourcesDir);
        asar = resourcesList.includes('app.asar');
  
        let packageJson: {main: string; name: string};
        if (asar) {
            const asarPath = path.join(resourcesDir, 'app.asar');
            packageJson = JSON.parse(ASAR.extractFile(asarPath, 'package.json').toString('utf8'));
            main = path.join(asarPath, packageJson.main);
        } else {
            packageJson = JSON.parse(fs.readFileSync(path.join(resourcesDir, 'app', 'package.json'), 'utf8'));
            main = path.join(resourcesDir, 'app', packageJson.main);
        }
        name = packageJson.name;
    } 
    else if (platform === 'win32') {
      // Windows Structure
      // <buildDir>/
      //   <appName>.exe (executable)
      //   resources/
      //     app.asar (asar bundle) - or -
      //     app
      //       package.json
      //       (your app structure)
  
        const list = fs.readdirSync(buildDir);
        const exe = list.find(fileName => {
            return fileName.endsWith('.exe');
        });

        executable = path.join(buildDir, exe);
  
        resourcesDir = path.join(buildDir, 'resources');
        const resourcesList = fs.readdirSync(resourcesDir);
        asar = resourcesList.includes('app.asar');
  
        let packageJson: {main: string; name: string};
  
        if (asar) {
            const asarPath = path.join(resourcesDir, 'app.asar');
            packageJson = JSON.parse(ASAR.extractFile(asarPath, 'package.json').toString('utf8'));
            main = path.join(asarPath, packageJson.main);
        } else {
            packageJson = JSON.parse(fs.readFileSync(path.join(resourcesDir, 'app', 'package.json'), 'utf8'));
            main = path.join(resourcesDir, 'app', packageJson.main);
        }
        name = packageJson.name;
    } 
    else {
        /**  @todo add support for linux */
        throw new Error(`Platform not supported: ${platform}`);
    }

    return { executable, main, asar, name, platform, resourcesDir, arch };
}

export function getRecordingPath(...paths: string[]): string {
    return path.join(TEST_OUTPUT_DIR, ...paths);
}

export function getMainWindow(windows: Page[]): Page {
    const mainWindow = windows.find(w => w.url().includes('index.html'));
    return mainWindow;
}

type Architecture = 'x64' | 'x32' | 'arm64';
export interface ElectronAppInfo {
  /** Path to the app's executable file */
  executable: string;
  /** Path to the app's main (JS) file */
  main: string;
  /** Name of the app */
  name: string;
  /** Resources directory */
  resourcesDir: string;
  /** True if the app is using asar */
  asar: boolean;
  /** OS platform */
  platform: 'darwin' | 'win32' | 'linux';
  arch: Architecture;
}

interface StartAppResponse {
    electronApp: ElectronApplication;
    appWindow: Page;
    appInfo: ElectronAppInfo;
}