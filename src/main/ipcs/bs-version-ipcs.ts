import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSInstallerService } from '../services/bs-installer.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service'

ipcMain.on('bs-version.request-versions', async (event, args) => {
    const bsVersionService = BSVersionManagerService.getInstance();
    const versions = (await bsVersionService.getAvailableVersions());
    UtilsService.getInstance().ipcSend('bs-version.request-versions', versions);
});

ipcMain.on('bs-version.installed-versions', async (event, args) => {
    UtilsService.getInstance().ipcSend('bs-version.installed-versions', await BSInstallerService.getInstance().getInstalledBsVersion())
});
