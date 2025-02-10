import { Observable } from "rxjs";
import { IpcService } from "./ipc.service";

export class LinuxService {

    private static instance: LinuxService;

    public static getInstance(): LinuxService {
        if (!LinuxService.instance) {
            LinuxService.instance = new LinuxService();
        }
        return LinuxService.instance;
    }

    private readonly ipc: IpcService;

    private constructor() {
        this.ipc = IpcService.getInstance();
    }

    public getWinePrefixPath(): Observable<string> {
        return this.ipc.sendV2("linux.get-wine-prefix-path");
    }


}
