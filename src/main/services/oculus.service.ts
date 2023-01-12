import { UtilsService } from "./utils.service";
import regedit from 'regedit'
import path from "path";

export class OculusService {

    private static instance: OculusService;

    private readonly utils: UtilsService;

    private oculusPaths: string[];

    public static getInstance(): OculusService{
        if(!OculusService.instance){ OculusService.instance = new OculusService(); }
        return OculusService.instance;
    }

    private constructor(){
        this.utils = UtilsService.getInstance();
    }

    public oculusRunning(): boolean{
        return this.utils.taskRunning("OculusClient.exe");
    }

    public async getOculusLibsPath(): Promise<string[]>{

        if(this.oculusPaths){ return this.oculusPaths; }

        const oculusLibsRegKey = "HKCU\\SOFTWARE\\Oculus VR, LLC\\Oculus\\Libraries";

        const libsRegData = (await regedit.promisified.list([oculusLibsRegKey]))["HKCU\\SOFTWARE\\Oculus VR, LLC\\Oculus\\Libraries"];

        if(!libsRegData.exists || !libsRegData.keys){ return null; }

        const libsPath = (await Promise.all(libsRegData.keys.map(async key => {
            const originalPath = (await regedit.promisified.list([`${oculusLibsRegKey}\\${key}`]))[`${oculusLibsRegKey}\\${key}`];
            if(!originalPath.exists || !libsRegData.values || !originalPath.values["OriginalPath"]){ return null; }

            return originalPath.values["OriginalPath"].value as string; 

        }, []))).filter(path => !!path);

        this.oculusPaths = libsPath;

        return libsPath;

    }

    public async getGameFolder(gameFolder: string): Promise<string>{
        
        const libsFolders = await this.getOculusLibsPath();

        if(!libsFolders){ return null; }

        const rootLibDir = "Software"

        for(const lib of libsFolders){
            const gameFullPath = path.join(lib, rootLibDir, gameFolder);
            if(this.utils.pathExist(gameFullPath)){ return gameFullPath; }
        }

        return null;
    }

}