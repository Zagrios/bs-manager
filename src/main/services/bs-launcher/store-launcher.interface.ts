import { Observable } from "rxjs";
import { BSLaunchEventData, LaunchOption } from "shared/models/bs-launch";

export interface StoreLauncherInterface {
    launch(launchOptions: LaunchOption): Observable<BSLaunchEventData>;
}