import { pathExistsSync } from "fs-extra";
import { from, of } from "rxjs";

import { InstallationLocationService } from "main/services/installation-location.service";
import { IpcService } from "main/services/ipc.service";

const ipc = IpcService.getInstance();

ipc.on("bs-installer.folder-exists", (_, reply) => {
    const service = InstallationLocationService.getInstance();
    reply(of(pathExistsSync(service.installationDirectory())));
});

ipc.on("bs-installer.default-install-path", (_, reply) => {
    const service = InstallationLocationService.getInstance();
    reply(of(service.defaultInstallationDirectory()));
});

ipc.on("bs-installer.install-path", (_, reply) => {
    const service = InstallationLocationService.getInstance();
    reply(of(service.installationDirectory()));
});

ipc.on("bs-installer.set-install-path", (args, reply) => {
    const service = InstallationLocationService.getInstance();
    reply(from(service.setInstallationDirectory(args.path, args.move)));
});
