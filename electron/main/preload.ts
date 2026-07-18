import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('viking', {
	receive: (ch: string, fn: (...a: unknown[]) => void) => {
		const listener = (_e: unknown, ...a: unknown[]) => fn(...a);
		ipcRenderer.on(ch, listener);
		return () => ipcRenderer.removeListener(ch, listener);
	},
	submit: (payload: { prompt: string; refineFrom?: unknown }) => ipcRenderer.send('viking:submit', payload),
	setActive: (idx: number) => ipcRenderer.send('viking:setActive', idx),
	resize: (height: number) => ipcRenderer.send('viking:resize', height),
	hide: () => ipcRenderer.send('viking:hide'),
	back: () => ipcRenderer.send('viking:back'),
	openSettings: () => ipcRenderer.send('viking:openSettings'),
	getSettings: () => ipcRenderer.invoke('viking:getSettings'),
	getModels: () => ipcRenderer.invoke('viking:getModels'),
	saveSettings: (s: { llm?: object; connectors?: object; hotkeys?: object; theme?: string; growth?: 'down' | 'up' }) => ipcRenderer.invoke('viking:saveSettings', s),
});
