import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from "electron";
import { ProviderPlatform } from "shared/models/provider-platform.enum";

const sep = process.platform === ProviderPlatform.WINDOWS ? "\\" : "/";

contextBridge.exposeInMainWorld("electron", {
    platform: process.platform,
    envVariables: {
        beatleader: {
            clientId: process.env.BEATLEADER_CLIENT_ID,
            redirectUri: process.env.BEATLEADER_REDIRECT_URI,
        },
    },
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
        basename: (path: string): string => {
            return !path ? "" : path.split(sep).at(-1);
        },
        join: (...args: string[]): string => {
            return args.join(sep);
        }
    },
    webUtils: {
        getPathForFile: webUtils.getPathForFile
    }
});
