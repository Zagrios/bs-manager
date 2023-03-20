import { ipcMain } from 'electron';
import { UtilsService } from '../services/utils.service';
import { BSVersionLibService } from '../services/bs-version-lib.service'
import { BSVersion } from 'shared/bs-version.interface';
import { exec } from 'child_process';
import { IpcRequest } from 'shared/models/ipc';
import { BSLocalVersionService } from '../services/bs-local-version.service';
import { BsmException } from 'shared/models/bsm-exception.model';
import { IpcService } from '../services/ipc.service';
import { from } from 'rxjs';
import path from 'path';
import { pathExist } from '../helpers/fs.helpers';
import { FolderLinkerService, LinkOptions } from '../services/folder-linker.service';
import { LocalMapsManagerService } from '../services/additional-content/local-maps-manager.service';
import { readJSON, writeJSON } from 'fs-extra';
import log from "electron-log"
import { VersionLinkerAction } from 'renderer/services/version-folder-linker.service';
import { VersionFolderLinkerService } from '../services/version-folder-linker.service';

const ipc = IpcService.getInstance();

ipcMain.on('bs-version.get-version-dict', (event, req: IpcRequest<void>) => {
   BSVersionLibService.getInstance().getAvailableVersions().then(versions => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false});
   })
});

ipcMain.on('bs-version.installed-versions', async (event, req: IpcRequest<void>) => {
   BSLocalVersionService.getInstance().getInstalledVersions().then(versions => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: true, data: versions});
   }).catch(() => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false});
   })
});

ipcMain.on("bs-version.open-folder", async (event, req: IpcRequest<BSVersion>) => {
   const localVersionService = BSLocalVersionService.getInstance();
   const versionFolder = await localVersionService.getVersionPath(req.args);
   (await pathExist(versionFolder)) && exec(`start "" "${versionFolder}"`);
});

ipcMain.on("bs-version.edit", async (event, req: IpcRequest<{version: BSVersion, name: string, color: string}>) => {
   BSLocalVersionService.getInstance().editVersion(req.args.version, req.args.name, req.args.color).then(res => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: !!res, data: res});
   }).catch((error: BsmException) => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false, error});
   });
});

ipcMain.on("bs-version.clone", async (event, req: IpcRequest<{version: BSVersion, name: string, color: string}>) => {
   BSLocalVersionService.getInstance().cloneVersion(req.args.version, req.args.name, req.args.color).then(res => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: !!res, data: res});
   }).catch((error: BsmException) => {
      UtilsService.getInstance().ipcSend(req.responceChannel, {success: false, error});
   });
});

ipc.on("get-version-full-path", async (req: IpcRequest<BSVersion>, reply) => {
    const localVersions = BSLocalVersionService.getInstance();
    reply(from( localVersions.getVersionPath(req.args) ));
});

ipc.on("relative-version-path-to-full", async (req: IpcRequest<{version: BSVersion, relative: string}>, reply) => {
    path.isAbsolute(req.args.relative) && reply(from(Promise.resolve(req.args.relative)));

    const localVersions = BSLocalVersionService.getInstance();
    const promise = localVersions.getVersionPath(req.args.version).catch(() => null).then(versionPath => {
        return path.join(versionPath, req.args.relative);
    });
    reply(from(promise));
});

ipc.on("full-version-path-to-relative", async (req: IpcRequest<{version: BSVersion, fullPath: string}>, reply) => {
    const localVersions = BSLocalVersionService.getInstance();
    const promise = localVersions.getVersionPath(req.args.version).catch(() => null).then(versionPath => {
        return path.relative(versionPath, req.args.fullPath);
    });
    reply(from(promise));
});

ipc.on("get-linked-folders", async (req: IpcRequest<{version: BSVersion, options?: { relative?: boolean }}>, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.getLinkedFolders(req.args.version, req.args.options)));
});

ipc.on("link-folder", async (req: IpcRequest<{ folder: string, options?: LinkOptions}>, reply) => {

    req.args.options ??= {};

    const linker = FolderLinkerService.getInstance();

    const relativeMapsFolder = path.join(LocalMapsManagerService.LEVELS_ROOT_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER)

    if(req.args.folder.includes(relativeMapsFolder)){
        return reply(from(linker.linkFolder(req.args.folder, {keepContents: req.args.options?.keepContents, intermediateFolder: LocalMapsManagerService.SHARED_MAPS_FOLDER})));
    }

    if(req.args.folder.includes("UserData")){
        req.args.options = { ...req.args.options, backup: true };
    }

    const res = from(linker.linkFolder(req.args.folder, req.args.options));

    const jsonIPAPath = path.join(req.args.folder, "Beat Saber IPA.json");

    if(!(await pathExist(jsonIPAPath))){ return reply(res); }

    await res.toPromise();

    try{
        const ipaData = (await readJSON(jsonIPAPath)) ?? {} as any;
        ipaData["YeetMods"] = false;
        await writeJSON(jsonIPAPath, ipaData, {spaces: 4});
    }catch(e){
        log.error("Disable YeetMods", e);
    }

    reply(res);

});

ipc.on("link-version-folder-action", async (req: IpcRequest<VersionLinkerAction>, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.doAction(req.args)));
});

ipc.on("is-version-folder-linked", async (req: IpcRequest<{ version: BSVersion, relativeFolder: string }>, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.isFolderLinked(req.args.version, req.args.relativeFolder)));
});

ipc.on("unlink-folder", async (req: IpcRequest<{ folder: string, options?: LinkOptions}>, reply) => {

    req.args.options ??= {};

    const linker = FolderLinkerService.getInstance();

    const relativeMapsFolder = path.join(LocalMapsManagerService.LEVELS_ROOT_FOLDER, LocalMapsManagerService.CUSTOM_LEVELS_FOLDER)

    if(req.args.folder.includes(relativeMapsFolder)){
        return reply(from(linker.unlinkFolder(req.args.folder, {...req.args.options, intermediateFolder: LocalMapsManagerService.SHARED_MAPS_FOLDER})));
    }

    if(req.args.folder.includes("UserData")){
        req.args.options = { ...req.args.options, backup: true };
    }

    reply(from(linker.unlinkFolder(req.args.folder, req.args.options)));

});


