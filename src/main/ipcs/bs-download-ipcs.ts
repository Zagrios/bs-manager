import { ipcMain } from "electron";
import { BSInstallerService, DownloadEventType, DownloadInfo } from "../services/bs-installer.service";
import { IpcRequest } from "shared/models/ipc";
import { InstallationLocationService } from "../services/installation-location.service";
import { UtilsService } from "../services/utils.service";
import { LocalMapsManagerService } from "../services/additional-content/local-maps-manager.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

export interface InitDownloadInfoInterface {
    cwd: string;
    folder: string;
    app: string;
    depot: string;
    manifest: string;
    username: string;
    stay: boolean;
}

const ipc = IpcService.getInstance();

ipcMain.on("is-dotnet-6-installed", async (event, request: IpcRequest<void>) => {
    const installer = BSInstallerService.getInstance();
    const utils = UtilsService.getInstance();
    installer.isDotNet6Installed().then(installed => {
        utils.ipcSend(request.responceChannel, { success: true, data: installed });
    });
});

ipcMain.on("bs-download.start", async (event, request: IpcRequest<DownloadInfo>) => {
    BSInstallerService.getInstance()
        .downloadBsVersion(request.args)
        .then(async res => {
            await LocalMapsManagerService.getInstance()
                .linkVersionMaps(request.args.bsVersion, true)
                .catch(e => {});
            UtilsService.getInstance().ipcSend(request.responceChannel, { success: true, data: res });
        })
        .catch(e => {
            UtilsService.getInstance().ipcSend(request.responceChannel, { success: false, data: e });
        });
});

ipcMain.on(`bs-download.${"[2FA]" as DownloadEventType}`, async (event, args: IpcRequest<string>) => {
    BSInstallerService.getInstance().sendInputProcess(args.args);
});

ipcMain.on("bs-download.kill", async (event, request: IpcRequest<void>) => {
    const res = await BSInstallerService.getInstance().killDownloadProcess();
    if (request.responceChannel) {
        UtilsService.getInstance().ipcSend(request.responceChannel, { success: res });
    }
});

ipcMain.on("bs-download.installation-folder", async (event, request: IpcRequest<void>) => {
    const installationFolder = InstallationLocationService.getInstance().installationDirectory;
    UtilsService.getInstance().ipcSend(request.responceChannel, { success: true, data: installationFolder });
});

ipc.on<string>("bs-download.set-installation-folder", (req, reply) => {
    const installerService = InstallationLocationService.getInstance();
    reply(from(installerService.setInstallationDirectory(req.args)));
});

ipcMain.on("bs-download.import-version", (event, request: IpcRequest<string>) => {
    const utils = UtilsService.getInstance();
    const installer = BSInstallerService.getInstance();
    installer
        .importVersion(request.args)
        .catch(e => {
            utils.ipcSend(request.responceChannel, { success: false, error: e });
        })
        .then(() => {
            utils.ipcSend(request.responceChannel, { success: true });
        });
});
