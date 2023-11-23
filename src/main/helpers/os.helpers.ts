import log from "electron-log";
import psList from "ps-list";

export async function taskRunning(task: string): Promise<boolean> {
    try {
        const processes = await psList();
        return processes.some(process => process.name?.includes(task) || process.cmd?.includes(task));
    }
    catch(error){
        log.error(error);
        return false;
    }
}