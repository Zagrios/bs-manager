import { BsOculusDownloaderService } from "../../services/bs-version-download/bs-oculus-downloader.service";
import { BsSteamDownloaderService } from "../../services/bs-version-download/bs-steam-downloader.service";
import { IpcService } from "../../services/ipc.service";
import { from, of } from "rxjs";
import { BSLocalVersionService } from "../../services/bs-local-version.service";

const ipc = IpcService.getInstance();

ipc.on("import-version", (args, reply) => {
    const versionManager = BSLocalVersionService.getInstance();
    reply(versionManager.importVersion(args));
});

// #region Steam

ipc.on("bs-steam-download", (args, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(steamDownloader.download(args));
});

ipc.on("bs-steam-download-respond", ({ downloadId, answer }, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(of(steamDownloader.respond(downloadId, answer)));
});

ipc.on("bs-steam-stop-download", (_, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(from(steamDownloader.stop()));
});

ipc.on("steam-session-exists", (_, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(from(steamDownloader.session.exists()));
});

ipc.on("steam-session-username", (_, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(from(steamDownloader.session.username()));
});

ipc.on("delete-steam-session", (_, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(from(steamDownloader.session.clear()));
});

ipc.on("import-legacy-steam-username", (username, reply) => {
    const steamDownloader = BsSteamDownloaderService.getInstance();
    reply(from(steamDownloader.session.importLegacyUsername(username)));
});

// #endregion

// #region Oculus

ipc.on("bs-oculus-download", (args, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.downloadVersion(args));
});

ipc.on("bs-oculus-stop-download", (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(of(oculusDownloader.stopDownload()));
});

ipc.on("login-with-meta", (stay, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(from(oculusDownloader.getUserTokenFromMetaAuth(stay)));
});

ipc.on("delete-meta-session", (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(from(oculusDownloader.clearAuthToken()));
});

ipc.on("meta-session-exists", (_, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(from(oculusDownloader.metaSessionExists()));
});

// #endregion
