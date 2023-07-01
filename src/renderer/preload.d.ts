declare global {
    interface Window {
        electron: {
            ipcRenderer: {
                sendMessage(channel: string, args: any): void;
                on(channel: string, func: (...args: any) => void): (() => void) | undefined;
                once(channel: string, func: (...args: any) => void): void;
                removeAllListeners(channel: string): void;
            };
        };
    }
}

export {};
