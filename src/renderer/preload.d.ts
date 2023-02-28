import { IpcChannel } from "shared/models/ipc/ipc-response.interface";

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: IpcChannel, args: any): void;
        on(
          channel: IpcChannel,
          func: (...args: any) => void
        ): (() => void) | undefined;
        once(channel: IpcChannel, func: (...args: any) => void): void;
        removeAllListeners(channel: IpcChannel): void;
      };
    };
  }
}

export {};
