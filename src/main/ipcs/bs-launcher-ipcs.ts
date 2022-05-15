import { ipcMain } from 'electron';
import path from "path";
import { spawn } from 'child_process';
import { UtilsService } from '../services/utils.service'
import { SteamService } from '../services/steam.service';
import { BSVersionManagerService } from '../services/bs-version-manager.service';
import { BSInstallerService } from '../services/bs-installer.service'
import { BS_EXECUTABLE, BS_APP_ID } from '../constants';

ipcMain.on('test-launch', async () => {
  console.log("steam "+ UtilsService.getInstance().taskRunning('steam.exe'));
  console.log(await SteamService.getInstance().getSteamGamesFolder());
  console.log(BSInstallerService.getInstance().getBSInstallationFolder());
  console.log((await BSVersionManagerService.getInstance().getAvailableVersions()));
  console.log(await BSVersionManagerService.getInstance().getVersionOfBSFolder(path.join(await SteamService.getInstance().getSteamGamesFolder(), "Beat Saber")));
  console.log(await BSInstallerService.getInstance().getInstalledBsVersion());
  return;

  const BS_EXE = "Beat Saber.exe"
  const BS_PATH = path.join('C:', 'Users', 'Mathieu', 'Desktop', 'BSLegacyLauncher', 'Beat Saber')
  let a = spawn(`\"${path.join(BS_PATH, BS_EXE)}\"`, ["-vrmode oculus", "--verbose"], { shell: true, cwd: BS_PATH,  env: {...process.env ,"SteamAppId": "620980"}});
  a.stdout.on('data', data => console.log(data.toString()));
  a.stderr.on('data', data => console.log(data.toString()));
  a.on('message', m => console.log(m));
  a.on('error', err => console.log(err));
  a.on('exit', e => console.log(e));
  a.on('disconnect', (d: any) => console.log(d))
  console.log('oui');
});

ipcMain.on('bs-launch.steam', async (event, args) => {
  const steamService = SteamService.getInstance();
  const beatSaberSteamFolder = path.join(await steamService.getSteamGamesFolder(), "Beat Saber");
  const beatSaberSteamExe = path.join(beatSaberSteamFolder, BS_EXECUTABLE);
  const spawnProcess = spawn(`\"${beatSaberSteamExe}\"`, [], {shell: true, cwd: beatSaberSteamFolder, env: {...process.env, "SteamAppId": BS_APP_ID}});


})
