import { ipcMain } from 'electron';
import path from "path";
import { spawn } from 'child_process';
import { UtilsService } from '../services/utils.service'
import { SteamService } from '../services/steam.service';
import { BSVersion, BSVersionManagerService } from '../services/bs-version-manager.service';
import { BSInstallerService } from '../services/bs-installer.service'
import { BS_EXECUTABLE, BS_APP_ID } from '../constants';

export interface LauchOption {
  version: BSVersion,
  oculus: boolean,
  desktop: boolean,
  debug: boolean
}

ipcMain.on('bs-launch.launch', async (event, args: LauchOption) => { //Create a service BSLauncherService
  const steamService = SteamService.getInstance();
  const installerService = BSInstallerService.getInstance();
  let cwd = "";
  if(!steamService.steamRunning()){ UtilsService.getInstance().ipcSend("bs-launch.launch", 1); return; }
  if(args.version.steam){
    cwd = await steamService.getGameFolder(BS_APP_ID, "Beat Saber");
  }
  else{
    cwd = path.join(installerService.installationFolder, args.version.BSVersion);
  }
  const exePath = path.join(cwd, BS_EXECUTABLE);
  if(!UtilsService.getInstance().pathExist(exePath)){ UtilsService.getInstance().ipcSend("bs-launch.launch", 2); return; }
  
  const launchMods = [];
  if(args.oculus){ launchMods.push("-vrmode oculus"); }
  if(args.debug){ launchMods.push("--verbose"); }
  if(args.desktop){ launchMods.push("fpfc"); }
  spawn(`\"${exePath}\"`, launchMods, {shell: true, cwd: cwd, env: {...process.env, "SteamAppId": BS_APP_ID}});

  UtilsService.getInstance().ipcSend("bs-launch.launch", 0);
});
