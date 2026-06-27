import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('viking', {
  on: (ch: string, fn: (...a: unknown[]) => void) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
  submit: (prompt: string) => ipcRenderer.send('viking:submit', prompt),
  hide: () => ipcRenderer.send('viking:hide'),
});
