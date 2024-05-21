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

export async function getProcessPid(task: string): Promise<number> {
    try {
        const processes = await psList();
        const process = processes.find(process => process.name?.includes(task) || process.cmd?.includes(task));
        return process?.pid;
    }
    catch(error){
        log.error(error);
        return null;
    }
}
