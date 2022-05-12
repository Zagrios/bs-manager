import { Channels, ReplyChannels } from 'main/preload';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        sendMessage(channel: Channels, args: any): void;
        on(
          channel: ReplyChannels,
          func: (...args: any) => void
        ): (() => void) | undefined;
        once(channel: ReplyChannels, func: (...args: any) => void): void;
      };
    };
  }
}

export {};
