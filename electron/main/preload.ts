import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('viking', {
	on: (ch: string, fn: (...a: unknown[]) => void) => ipcRenderer.on(ch, (_e, ...a) => fn(...a)),
	submit: (payload: { prompt: string; refineFrom?: unknown }) => ipcRenderer.send('viking:submit', payload),
	setActive: (idx: number) => ipcRenderer.send('viking:setActive', idx),
	resize: (height: number) => ipcRenderer.send('viking:resize', height),
	hide: () => ipcRenderer.send('viking:hide'),
	back: () => ipcRenderer.send('viking:back'),
	openSettings: () => ipcRenderer.send('viking:openSettings'),
	getSettings: () => ipcRenderer.invoke('viking:getSettings'),
	getModels: () => ipcRenderer.invoke('viking:getModels'),
	saveSettings: (s: { llm?: object; hotkeys?: object; theme?: string }) => ipcRenderer.invoke('viking:saveSettings', s),
});
