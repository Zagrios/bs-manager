import { BsOculusDownloaderService } from "../../services/bs-version-download/bs-oculus-downloader.service";
import { BsSteamDownloaderService, DownloadInfo, DownloadSteamInfo } from "../../services/bs-version-download/bs-steam-downloader.service";
import { InstallationLocationService } from "../../services/installation-location.service";
import { IpcService } from "../../services/ipc.service";
import { from, of } from "rxjs";
import { BSLocalVersionService, ImportVersionOptions } from "../../services/bs-local-version.service";

const ipc = IpcService.getInstance();

ipc.on<ImportVersionOptions>("import-version", (req, reply) => {
    const versionManager = BSLocalVersionService.getInstance();
    reply(versionManager.importVersion(req.args));
});

// #region Steam 

ipc.on("is-dotnet-6-installed", (_, reply) => {
    const installer = BsSteamDownloaderService.getInstance();
    reply(from(installer.isDotNet6Installed()));
});

ipc.on("bs-download.installation-folder", (_, reply) => {
    const installLocation = InstallationLocationService.getInstance();
    reply(from(installLocation.installationDirectory()));
});

ipc.on<string>("bs-download.set-installation-folder", (req, reply) => {
    const installerService = InstallationLocationService.getInstance();
    reply(from(installerService.setInstallationDirectory(req.args)));
});

ipc.on<DownloadSteamInfo>("auto-download-bs-version", (req, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.autoDownloadBsVersion(req.args));
});

ipc.on<DownloadSteamInfo>("download-bs-version", (req, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.downloadBsVersion(req.args))
});

ipc.on<DownloadSteamInfo>("download-bs-version-qr", (req, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(bsInstaller.downloadBsVersionWithQRCode(req.args))
});

ipc.on("stop-download-bs-version", (_, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(of(bsInstaller.stopDownload()));
});

ipc.on<string>("send-input-bs-download", (req, reply) => {
    const bsInstaller = BsSteamDownloaderService.getInstance();
    reply(of(bsInstaller.sendInput(req.args)));
});

// #endregion

// #region Oculus

ipc.on<DownloadInfo>("bs-oculus-download", async (req, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.downloadVersion(req.args));
});

ipc.on<DownloadInfo>("bs-oculus-auto-download", async (req, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.autoDownloadVersion(req.args));
});

ipc.on("bs-oculus-stop-download", async (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(of(oculusDownloader.stopDownload()));
});

ipc.on("bs-oculus-has-auth-token", async (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(from(oculusDownloader.getAuthToken().then(token => !!token)));
});

ipc.on("bs-oculus-clear-auth-token", async (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(from(oculusDownloader.clearAuthToken()));
});

// #endregion