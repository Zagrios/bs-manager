import { OculusService } from "../services/oculus.service";
import { IpcService } from "../services/ipc.service";
import { from } from "rxjs";

const ipc = IpcService.getInstance();

ipc.on("is-oculus-sideloaded-apps-enabled", (_, reply) => {
    const oculusService = OculusService.getInstance();
    reply(from(oculusService.isSideLoadedAppsEnabled()));
});

ipc.on("enable-oculus-sideloaded-apps", (_, reply) => {
    const oculusService = OculusService.getInstance();
    reply(from(oculusService.enableSideloadedApps()));
});
