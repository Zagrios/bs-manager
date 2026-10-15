import { Observable } from "rxjs";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, LaunchOption } from "../../../shared/models/bs-launch";
import { OculusService } from "../oculus.service";
import { BS_EXECUTABLE } from "../../constants";
import path from "path";
import log from "electron-log";
import { isProcessRunning } from "../../helpers/process-table";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { planLaunch } from "./launch-plan";
import { defaultGameLauncherPorts, GameLauncherPorts, launchContext, launchGame } from "./launcher-ports";
import { ProcessTrackingError } from "./owned-process-session";

export type OculusLauncherPorts = GameLauncherPorts & {
    oculus: Pick<OculusService, "startOculus">;
};

export function defaultOculusLauncherPorts(): OculusLauncherPorts {
    return {
        ...defaultGameLauncherPorts(),
        oculus: OculusService.getInstance(),
    };
}

export class OculusLauncherService implements StoreLauncherInterface {

    public static instance: OculusLauncherService;

    public static getInstance(): OculusLauncherService {
        if (!OculusLauncherService.instance) {
            OculusLauncherService.instance = new OculusLauncherService();
        }
        return OculusLauncherService.instance;
    }

    public constructor(private readonly ports: OculusLauncherPorts = defaultOculusLauncherPorts()) {}

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {

        return new Observable<BSLaunchEventData>(obs => {
            (async () => {

                // Cannot start multiple instances of Beat Saber with Oculus
                const bsRunning = await isProcessRunning(BS_EXECUTABLE, this.ports.session.processes);
                if(bsRunning){
                    throw CustomError.fromError(new Error("Cannot start two instance of Beat Saber for Oculus"), BSLaunchError.BS_ALREADY_RUNNING);
                }

                const bsPath = await this.ports.localVersions.getInstalledVersionPath(launchOptions.version);
                const exePath = path.join(bsPath, BS_EXECUTABLE);

                if(!(await this.ports.pathExists(exePath))){
                    throw CustomError.fromError(new Error(`BS Path not exist ${bsPath}`), BSLaunchError.BS_NOT_FOUND);
                }

                // Make sure Oculus is running
                await this.ports.oculus.startOculus().catch(err => {
                    if (err instanceof CustomError) throw err;

                    log.error("Error while starting Oculus", err);
                    log.warn("Unable to start Oculus client. Force launch.");
                });

                const plan = await planLaunch(
                    { store: "oculus", launchOptions, gameFolder: bsPath },
                    launchContext(this.ports)
                );

                obs.next({type: BSLaunchEvent.BS_LAUNCHING});

                const session = await launchGame(this.ports, plan, bsPath, "untracked");
                try {
                    return await session.exit;
                } catch (error) {
                    if (error instanceof ProcessTrackingError) { throw error; }
                    throw CustomError.fromError(error as Error, BSLaunchError.BS_EXIT_ERROR);
                }

            })().then(exitCode => {
                log.info("BS process exit code", exitCode);
            }).catch(err => {
                if(err instanceof CustomError){
                    obs.error(err);
                } else {
                    obs.error(CustomError.fromError(err, BSLaunchError.UNKNOWN_ERROR));
                }
            }).finally(() => {
                obs.complete();
            })
        });
    }

}
