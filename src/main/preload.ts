import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { ProviderPlatform } from "shared/models/provider-platform.enum";

const sep = process.platform === ProviderPlatform.WINDOWS ? "\\" : "/";

contextBridge.exposeInMainWorld("electron", {
    platform: process.platform,
    ipcRenderer: {
        sendMessage(channel: string, args: unknown[]) {
            ipcRenderer.send(channel, args);
        },
        on(channel: string, func: (...args: unknown[]) => void) {
            const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => func(...args);
            ipcRenderer.on(channel, subscription);

            return () => ipcRenderer.removeListener(channel, subscription);
        },
        once(channel: string, func: (...args: unknown[]) => void) {
            ipcRenderer.once(channel, (_event, ...args) => func(...args));
        },
        removeAllListeners(channel: string) {
            ipcRenderer.removeAllListeners(channel);
        },
    },
    path: {
        sep,
        join: (...args: string[]): string => {
            return args.join(sep);
        }
    }
});
