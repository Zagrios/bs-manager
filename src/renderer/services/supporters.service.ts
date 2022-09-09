import { Supporter } from "shared/models/supporters";
import { IpcService } from "./ipc.service";


export class SupportersService {

    private static instance: SupportersService;

    private ipcService: IpcService;

    private constructor(){
        this.ipcService = IpcService.getInstance();
    }

    public static getInstance(): SupportersService{
        if(!SupportersService.instance){ SupportersService.instance = new SupportersService(); }
        return SupportersService.instance;
    }

    public getSupporters(): Promise<Supporter[]>{
        return this.ipcService.send<Supporter[]>("get-supporters").then(res => {
            if(!res.success){ return null; }
            return res.data;
        });
    }

}