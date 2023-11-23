/// const { AfterPackContext } = require("electron-builder");
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require("path");
 
exports.fuseElectron = async function fuseElectron({
    appOutDir,
    packager,
    electronPlatformName,
}){

    const { productFilename } = packager.appInfo;

    const target = (() => {
        switch (electronPlatformName) {
            case "darwin":
                return `${productFilename}.app`;
            case "win32":
                return `${productFilename}.exe`;
            case "linux":
                // Sadly, `LinuxPackager` type is not exported by electron-builder so we have to improvise
                return packager.executableName;
            default:
                throw new Error(`Unsupported platform: ${electronPlatformName}`);
        }
    })();

    const electron = path.join(appOutDir, target);

    console.log(`Fusing electron at ${electron}`);

    return flipFuses(electron, {
        version: FuseVersion.V1,
        [FuseV1Options.EnableCookieEncryption]: true,
    });

}