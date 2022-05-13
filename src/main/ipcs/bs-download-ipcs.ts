// const script = path.join(path.dirname(__dirname), 'extraRessources', 'DepotDownloader', 'DepotDownloader.exe');;
//   const intance = spawn(script, ['-username lekilleur618', '-manifest 4038188869828689801', '-depot 620981', '-app 620980', '-remember-password'], {cwd: "C:\\test", shell: true});
//   intance.stdout.on('data', (data) =>{
//     console.log(data.toString());
//     if(data.toString().includes('Enter account password for')){
//       intance.stdin.write('MmBopN8qez5gKFZX\n');
//     }
//   });
//   intance.stderr.on('data', (data) => console.log(data.toString()));
//   intance.on('message', (message) => {console.log(message.toString())});

import { ipcMain } from 'electron';
import path from 'path';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createFolderIfNotExist } from '../utils';


export interface InitDownloadInfoInterface {
  cwd: string ,
  folder: string,
  app: string,
  depot: string,
  manifest: string,
  username: string,
  stay: boolean
}

const DEPOT_DOWNLOADER_EXE = 'DepotDownloader.exe';
const DEPOT_DOWNLOADER_PATH = path.join(path.dirname(__dirname), '..', 'extraResources', 'depot-downloader', DEPOT_DOWNLOADER_EXE);

let PROCESS: ChildProcessWithoutNullStreams;

ipcMain.on('bs-download.start', async (event, args: InitDownloadInfoInterface) => {
  console.log(DEPOT_DOWNLOADER_PATH);
  console.log(args.cwd);
  createFolderIfNotExist(args.cwd);
  PROCESS = spawn(DEPOT_DOWNLOADER_PATH, [`-app ${args.app}`, `-depot ${args.depot}`, `-manifest ${args.manifest}`, `-username ${args.username}`, `-dir ${args.folder}`, args.stay ? `-remember-password` : ''], {shell: true, cwd: args.cwd});

  PROCESS.stdout.on('data', data => {

    const out: string[] = data.toString().split('|');
    console.log(out);

    if(out[0] === "[Progress]"){ event.reply('bs-download.progress', out[1]); }
    else if(out[0] === "[Password]"){ event.reply('bs-download.ask-password'); }
    else if(out[0] === "[2FA]"){ event.reply('bs-download.ask-2fa'); }
    else if(out[0] === "[Guard]"){ event.reply('bs-download.ask-guard'); }
    else if(out[0] === "[Error]"){ event.reply('bs-download.error', out); }

  });

  PROCESS.stderr.on('data', (data) => {console.log(data.toString())});
});

ipcMain.on('bs-download.send-input', async (event, value: string) => {
    if(PROCESS){ PROCESS.stdin.write(`${value}\n`); }
});
