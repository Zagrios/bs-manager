import { BSInstallerService, DownloadInfo } from "../services/bs-installer.service";
import { InstallationLocationService } from "../services/installation-location.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("is-dotnet-6-installed", (_, reply) => {
    const installer = BSInstallerService.getInstance();
    reply(from(installer.isDotNet6Installed()));
});

ipc.on("bs-download.installation-folder", (_, reply) => {
    const installLocation = InstallationLocationService.getInstance();
    reply(of(installLocation.installationDirectory));
});

ipc.on<string>("bs-download.set-installation-folder", (req, reply) => {
    const installerService = InstallationLocationService.getInstance();
    reply(from(installerService.setInstallationDirectory(req.args)));
});

ipc.on<string>("bs-download.import-version", (req, reply) => {
    const installer = BSInstallerService.getInstance();
    reply(from(installer.importVersion(req.args)));
});

ipc.on<DownloadInfo>("auto-download-bs-version", (req, reply) => {
    const bsInstaller = BSInstallerService.getInstance();
    reply(bsInstaller.autoDownloadBsVersion(req.args));
});

ipc.on<DownloadInfo>("download-bs-version", (req, reply) => {
    const bsInstaller = BSInstallerService.getInstance();
    reply(bsInstaller.downloadBsVersion(req.args))
});

ipc.on<DownloadInfo>("download-bs-version-qr", (req, reply) => {
    const bsInstaller = BSInstallerService.getInstance();
    reply(bsInstaller.downloadBsVersionWithQRCode(req.args))
});

ipc.on("stop-download-bs-version", (_, reply) => {
    const bsInstaller = BSInstallerService.getInstance();
    reply(of(bsInstaller.stopDownload()));
});

ipc.on<string>("send-input-bs-download", (req, reply) => {
    const bsInstaller = BSInstallerService.getInstance();
    reply(of(bsInstaller.sendInput(req.args)));
});
