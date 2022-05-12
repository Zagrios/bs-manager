export function createFolderIfNotExist(path: string){
    const [existsSync, mkdirSync] = [require('fs').existsSync, require('fs').mkdirSync];
    if (!existsSync(path)){ mkdirSync(path); }
}