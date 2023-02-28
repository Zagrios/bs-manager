import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannel } from 'shared/models/ipc/ipc-response.interface';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    sendMessage(channel: IpcChannel, args: unknown[]) {
      ipcRenderer.send(channel, args);
    },
    on(channel: IpcChannel, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => ipcRenderer.removeListener(channel, subscription);
    },
    once(channel: IpcChannel, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    removeAllListeners(channel: IpcChannel) {
        ipcRenderer.removeAllListeners(channel);
    }
  },
});
