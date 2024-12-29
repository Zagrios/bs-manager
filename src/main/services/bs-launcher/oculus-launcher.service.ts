import { Observable, ReplaySubject } from "rxjs";
import { StoreLauncherInterface } from "./store-launcher.interface";
import { BSLaunchError, BSLaunchEvent, BSLaunchEventData, LaunchOption } from "../../../shared/models/bs-launch";
import { OculusService } from "../oculus.service";
import { BS_EXECUTABLE } from "../../constants";
import path from "path";
import log from "electron-log";
import { pathExists } from "fs-extra";
import { AbstractLauncherService } from "./abstract-launcher.service";
import { isProcessRunning } from "../../helpers/os.helpers";
import { CustomError } from "../../../shared/models/exceptions/custom-error.class";
import { UtilsService } from "../utils.service";

export class OculusLauncherService extends AbstractLauncherService implements StoreLauncherInterface {

    public static instance: OculusLauncherService;

    public static getInstance(): OculusLauncherService {
        if (!OculusLauncherService.instance) {
            OculusLauncherService.instance = new OculusLauncherService();
        }
        return OculusLauncherService.instance;
    }

    private readonly oculus: OculusService;
    private readonly util: UtilsService;

    private readonly oculusLib$ = new ReplaySubject<string>();

    private constructor() {
        super();
        this.oculus = OculusService.getInstance();
        this.util = UtilsService.getInstance();
    }

    public launch(launchOptions: LaunchOption): Observable<BSLaunchEventData> {

        return new Observable<BSLaunchEventData>(obs => {
            (async () => {

                // Cannot start multiple instances of Beat Saber with Oculus
                const bsRunning = await isProcessRunning(BS_EXECUTABLE).catch(() => false);
                if(bsRunning){
                    throw CustomError.fromError(new Error("Cannot start two instance of Beat Saber for Oculus"), BSLaunchError.BS_ALREADY_RUNNING);
                }

                const bsPath = await this.localVersions.getInstalledVersionPath(launchOptions.version);
                const exePath = path.join(bsPath, BS_EXECUTABLE);

                if(!(await pathExists(exePath))){
                    throw CustomError.fromError(new Error(`BS Path not exist ${bsPath}`), BSLaunchError.BS_NOT_FOUND);
                }

                // Make sure Oculus is running
                await this.oculus.startOculus().catch(err => log.error("Error while starting Oculus", err));

                obs.next({type: BSLaunchEvent.BS_LAUNCHING});

                // Launch Beat Saber
                const process = this.launchBs(exePath, this.buildBsLaunchArgs(launchOptions));

                return process.exit.catch(err => {
                    throw CustomError.fromError(err, BSLaunchError.BS_EXIT_ERROR);
                });

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
