import { AutoUpdaterService } from "../services/auto-updater.service";
import { IpcService } from "../services/ipc.service";
import { from, of } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("download-update", (_, reply) => {
    const updaterService = AutoUpdaterService.getInstance();
    reply(updaterService.downloadUpdate());
});

ipc.on("check-update", (_, reply) => {
    const updaterService = AutoUpdaterService.getInstance();
    reply(from(updaterService.isUpdateAvailable()));
});

ipc.on("get-available-update", (_, reply) => {
    const updaterService = AutoUpdaterService.getInstance();
    reply(from(updaterService.getAvailableUpdate()));
});

ipc.on("install-update", (_, reply) => {
    const updaterService = AutoUpdaterService.getInstance();
    reply(of(updaterService.quitAndInstall()));
});
