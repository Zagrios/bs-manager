import { BsOculusDownloaderService } from "../../services/bs-version-download/bs-oculus-downloader.service";
import { BsSteamDownloaderService } from "../../services/bs-version-download/bs-steam-downloader.service";
import { IpcService } from "../../services/ipc.service";
import { of } from "rxjs";
import { BSLocalVersionService } from "../../services/bs-local-version.service";

const ipc = IpcService.getInstance();

ipc.on("import-version", (args, reply) => {
    const versionManager = BSLocalVersionService.getInstance();
    reply(versionManager.importVersion(args));
});

// #region Steam

ipc.on("auto-download-bs-version", (args, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.autoDownloadBsVersion(args));
});

ipc.on("download-bs-version", (args, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.downloadBsVersion(args))
});

ipc.on("download-bs-version-qr", (args, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.downloadBsVersionWithQRCode(args))
});

ipc.on("stop-download-bs-version", (_, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(of(bsInstaller.stopDownload()));
});

ipc.on("send-input-bs-download", (args, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(of(bsInstaller.sendInput(args)));
});

// #endregion

// #region Oculus

ipc.on("bs-oculus-download", async (args, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.downloadVersion(args));
});

ipc.on("bs-oculus-stop-download", async (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(of(oculusDownloader.stopDownload()));
});

// #endregion
