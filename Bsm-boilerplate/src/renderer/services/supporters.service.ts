import { Supporter } from "shared/models/supporters";
import { IpcService } from "./ipc.service";
import { lastValueFrom } from "rxjs";

export class SupportersService {
    private static instance: SupportersService;

    private ipcService: IpcService;

    private constructor() {
        this.ipcService = IpcService.getInstance();
    }

    public static getInstance(): SupportersService {
        if (!SupportersService.instance) {
            SupportersService.instance = new SupportersService();
        }
        return SupportersService.instance;
    }

    public getSupporters(): Promise<Supporter[]> {
        return lastValueFrom(this.ipcService.sendV2("get-supporters"));
    }
}
