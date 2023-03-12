import { move } from "fs-extra";
import { access, mkdir, rm, readdir, unlink, lstat, readlink } from "fs/promises";
import path from "path";
import { Observable } from "rxjs";
import log from "electron-log"

export async function pathExist(path: string): Promise<boolean> {
    try{
        await access(path);
        return true;
    }catch(e){
        return false;
    }
    
}

export async function ensureFolderExist(path: string): Promise<void> {
    if(await pathExist(path)){ return Promise.resolve(); }
    return mkdir(path, {recursive: true}).catch(log.error).then(() => {});
}

export async function deleteFolder(folderPath: string): Promise<void> {
    if(!(await pathExist(folderPath))){ return; }
    return rm(folderPath, {recursive: true, force: true});
}

export async function unlinkPath(path: string): Promise<void>{
    if(!(await pathExist(path))){ return; }
    return unlink(path);
}

export async function getFoldersInFolder(folderPath: string): Promise<string[]> {
    if(!(await pathExist(folderPath))){ return []; }

    const files = await readdir(folderPath, {withFileTypes: true});

    const promises = files.map(async file => {
        if(file.isDirectory()){ return path.join(folderPath, file.name); }
        if(!file.isSymbolicLink()){ return undefined; }
        try{
            const targetPath = await readlink(path.join(folderPath, file.name));
            return (await lstat(targetPath)).isDirectory() ? path.join(folderPath, file.name) : undefined;
        }catch(e){
            return undefined;
        }
    });

    return (await Promise.all(promises)).filter(folder => folder);
}

export function moveFolderContent(src: string, dest: string): Observable<Progression>{    
    const progress: Progression = { current: 0, total: 0 }; 
    return new Observable<Progression>(subscriber => {
        subscriber.next(progress);
        (async () => {

            const srcExist = await pathExist(src);

            if(!srcExist){ return subscriber.complete(); }
            
            ensureFolderExist(dest);

            const files = await readdir(src, {encoding: "utf-8"});
            progress.total = files.length;

            const promises = files.map(async file => {
                const srcFullPath = path.join(src, file);
                const destFullPath = path.join(dest, file);
                if(await pathExist(destFullPath)){
                    progress.current++;
                    return subscriber.next(progress);
                }
                await move(srcFullPath, destFullPath);
                progress.current++;
                subscriber.next(progress);
            });

            Promise.allSettled(promises).then(() => subscriber.complete());

        })();
    });
}

export interface Progression<T = unknown>{
    total: number;
    current: number;
    extra?: T;
}

