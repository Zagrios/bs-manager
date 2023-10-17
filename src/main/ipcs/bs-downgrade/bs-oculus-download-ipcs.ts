import { BsOculusDownloaderService, OculusDownloadInfo } from "../../services/bs-oculus-downloader.service";
import { IpcService } from "../../services/ipc.service";
import { BSVersion } from "shared/bs-version.interface";

const ipc = IpcService.getInstance();

ipc.on<OculusDownloadInfo>("bs-oculus-download", async (req, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.downloadVersion(req.args));
});

ipc.on<BSVersion>("bs-oculus-auto-download", async (req, reply) => {
    const oculusDownloader = BsOculusDownloaderService.getInstance();
    reply(oculusDownloader.autoDownloadVersion(req.args));
});