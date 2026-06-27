import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('viking', {
  on: (ch: string, fn: (...a: unknown[]) => void) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
  submit: (payload: { prompt: string; refineFrom?: unknown }) => ipcRenderer.send('viking:submit', payload),
  setActive: (idx: number) => ipcRenderer.send('viking:setActive', idx),
  resize: (height: number) => ipcRenderer.send('viking:resize', height),
  hide: () => ipcRenderer.send('viking:hide'),
  getSettings: () => ipcRenderer.invoke('viking:getSettings'),
  saveSettings: (s: { baseURL: string; apiKey: string; model: string }) => ipcRenderer.invoke('viking:saveSettings', s),
});
