import { shell } from "electron";
import { BSVersionLibService } from "../services/bs-version-lib.service";
import { BSLocalVersionService } from "../services/bs-local-version.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";
import path from "path";
import { pathExists } from "fs-extra";
import { VersionFolderLinkerService } from "../services/version-folder-linker.service";

const ipc = IpcService.getInstance();

ipc.on("bs-version.get-version-dict", (_, reply) => {
    const versionsLib = BSVersionLibService.getInstance();
    reply(from(versionsLib.getAvailableVersions()));
});

ipc.on("bs-version.installed-versions", (_, reply) => {
    const versions = BSLocalVersionService.getInstance();
    reply(from(versions.getInstalledVersions()));
});

ipc.on("bs-version.open-folder", (args, reply) => {
    const versions = BSLocalVersionService.getInstance();
    const promise = versions.getVersionPath(args).then(versionFolder => {
        if(!versionFolder || !pathExists(versionFolder)) return;
        shell.openPath(versionFolder);
    })
    reply(from(promise));
});

ipc.on("bs-version.edit", (args, reply) => {
    const versions = BSLocalVersionService.getInstance();
    reply(from(versions.editVersion(args.version, args.name, args.color)));
});

ipc.on("bs-version.clone", (args, reply) => {
    const versions = BSLocalVersionService.getInstance();
    reply(from(versions.cloneVersion(args.version, args.name, args.color)));
});

ipc.on("get-version-full-path", (args, reply) => {
    const localVersions = BSLocalVersionService.getInstance();
    reply(from(localVersions.getVersionPath(args)));
});

ipc.on("full-version-path-to-relative", (args, reply) => {
    const localVersions = BSLocalVersionService.getInstance();
    reply(from(localVersions.getVersionPath(args.version).then(versionPath => path.relative(versionPath, args.fullPath))));
});

ipc.on("get-linked-folders", (args, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.getLinkedFolders(args.version, args.options)));
});

ipc.on("link-version-folder-action", (args, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.doAction(args)));
});

ipc.on("is-version-folder-linked", (args, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.isFolderLinked(args.version, args.relativeFolder)));
});

ipc.on("relink-all-versions-folders", (_, reply) => {
    const versionLinker = VersionFolderLinkerService.getInstance();
    reply(from(versionLinker.relinkAllVersionsFolders()));
});
