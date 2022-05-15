import { ipcMain } from 'electron';
import { readdirSync } from 'fs';
import { UtilsService } from '../services/utils.service';
import { BSInstallerService } from '../services/bs-installer.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service'

ipcMain.on('bs-version.request-versions', async (event, args) => {
    const bsVersionService = BSVersionManagerService.getInstance();
    const versions = (await bsVersionService.getAvailableVersions());
    event.reply('bs-version.request-versions', versions);
});

ipcMain.on('bs-version.installed-versions', async (event, args) => {
    event.reply('bs-version.installed-versions', await BSInstallerService.getInstance().getInstalledBsVersion())
})
