import { webUtils } from "electron";

declare global {
    interface Window {
        electron: {
            platform: "win32"|"linux"|"darwin",
            envVariables: {
                beatleader: {
                    clientId: string;
                    redirectUri: string;
                };
            };
            ipcRenderer: {
                sendMessage(channel: string, args: any): void;
                on(channel: string, func: (...args: any) => void): (() => void) | undefined;
                once(channel: string, func: (...args: any) => void): void;
                removeAllListeners(channel: string): void;
            };
            path: {
                sep: "/"|"\\";
                basename: (path: string) => string;
                join: (...args: string[]) => string;
            };
            webUtils: {
                getPathForFile: typeof webUtils.getPathForFile;
            };
        };
    }
}

export {};
