import { ipcMain } from "electron";
import { BSUninstallerService } from "../services/bs-uninstaller.service";
import { BSVersion } from "main/services/bs-version-manager.service";
import { UtilsService } from "../services/utils.service";

ipcMain.on('bs.uninstall', async (event, args: BSVersion) => {

    const bsUninstallerService = BSUninstallerService.getInstance();
    const utilsService = UtilsService.getInstance();

    bsUninstallerService.uninstall(args)
    .then(() => {
        utilsService.ipcSend("bs.uninstall.success");
    })
    .catch((e) => {
        utilsService.ipcSend("bs.uninstall.error", e)
    })  
});