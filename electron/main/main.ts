import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';
import { generate, type LaunchArgs } from './agent/llm';
import type { Option } from './agent/code/shared-types';
import { closeMcpConnections, warmMcpConnections } from './agent/tools/utils';
import { getGatewayModels } from './agent/gateway-models';

// Caller passes the payload after '--args'. Chromium/Electron may inject its
// own flags between '--args' and our payload, so skip flag-shaped tokens and
// take the trailing two positionals.
function parseLaunchArgs(argv: string[]): LaunchArgs {
	const i = argv.indexOf('--args');
	if (i < 0) return {};
	const tail = argv.slice(i + 1).filter(a => !a.startsWith('-')).slice(-2);
	return { cwd: tail[0], activeFile: tail[1] };
}

let currentLaunch: LaunchArgs = parseLaunchArgs(process.argv);
console.log('[viking] process argv:', process.argv);
console.log('[viking] launch args:', currentLaunch);

function warmLaunchConnections(launch: LaunchArgs): void {
	const cwd = launch.cwd || config.cwd;
	void warmMcpConnections(cwd)
		.then(() => console.log('[viking] MCP connections ready:', cwd))
		.catch(error => console.error('[viking] MCP connection failed:', error));
}

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	warmLaunchConnections(currentLaunch);
	app.on('second-instance', (_e, argv) => {
		console.log('[viking] second-instance argv:', argv);
		currentLaunch = parseLaunchArgs(argv);
		console.log('[viking] launch args:', currentLaunch);
		warmLaunchConnections(currentLaunch);
		if (currentLaunch.cwd) show('textbox');
	});
}

const settingsFile = () => path.join(app.getPath('userData'), 'viking-settings.json');
// ponytail: plaintext api key on disk under the user's app data. Swap for keytar if shared machines matter.
type Persisted = { llm?: Partial<typeof config.llm>; hotkeys?: Partial<typeof config.hotkeys>; theme?: string; growth?: 'down' | 'up' };
function loadSettings(): void {
	try {
		const j: Persisted = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
		if (j.llm) Object.assign(config.llm, j.llm);
		if (j.hotkeys) {
			delete (j.hotkeys as { home?: string }).home; // ponytail: 'home' hotkey removed; persisted files would resurrect it
			if (j.hotkeys.settings === 'CommandOrControl+K') delete j.hotkeys.settings; // ponytail: old default; drop so the new ⌘S default applies
			Object.assign(config.hotkeys, j.hotkeys);
		}
		if (j.theme) config.theme = j.theme;
		if (j.growth) config.growth = j.growth;
	} catch { }
}
function saveSettings(s: Persisted): void {
	if (s.llm) Object.assign(config.llm, s.llm);
	if (s.hotkeys) Object.assign(config.hotkeys, s.hotkeys);
	if (s.theme) config.theme = s.theme;
	if (s.growth) config.growth = s.growth;
	fs.writeFileSync(settingsFile(), JSON.stringify({ llm: config.llm, hotkeys: config.hotkeys, theme: config.theme, growth: config.growth }, null, 2));
}

let win: BrowserWindow | null = null;
let lastOptions: Option[] = [];
let activeIdx = 0;
let mode: 'spotlight' | 'full' = 'full';
let rendererReady = false;
let pendingShow: { mode: 'textbox' | 'followup'; refineFrom?: Option } | null = null;

// h is each mode's floor/initial height; content reports its real height via viking:resize.
const SIZES = {
	spotlight: { w: 600, h: 64, y: 80 },
	full: { w: 720, h: 200, y: 16 },
};

// Spotlight-style: the user never resizes the window; content height drives it.
function setMode(next: 'spotlight' | 'full'): void {
	if (!win || mode === next) return;
	mode = next;
	const area = screen.getPrimaryDisplay().workArea;
	const { w, h, y } = SIZES[next];
	// growth 'up': mirror the top-anchored y as a bottom margin so a mode switch doesn't teleport a bottom-dweller to the top.
	const top = config.growth === 'up' ? area.y + area.height - h - y : y;
	win.setBounds({ x: Math.round((area.width - w) / 2), y: top, width: w, height: h });
}

// Keep the frameless overlay reachable: clamp bounds inside its display's work area.
function clampToWorkArea(b: Electron.Rectangle): Electron.Rectangle {
	const wa = screen.getDisplayMatching(b).workArea;
	return {
		...b,
		x: Math.max(wa.x, Math.min(b.x, wa.x + wa.width - b.width)),
		y: Math.max(wa.y, Math.min(b.y, wa.y + wa.height - b.height)),
	};
}

function createWindow(): BrowserWindow {
	rendererReady = false;
	const { width } = screen.getPrimaryDisplay().workAreaSize;
	const { w, h, y } = SIZES.full;
	const w0 = new BrowserWindow({
		width: w, height: h,
		x: Math.round((width - w) / 2), y,
		transparent: true, frame: false, resizable: false, movable: true,
		alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
		webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
	});
	w0.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
	w0.setAlwaysOnTop(true, 'screen-saver');
	// 'moved' fires when a drag ends (macOS); snap back if the window left the screen.
	w0.on('moved', () => {
		const b = w0.getBounds();
		const c = clampToWorkArea(b);
		if (c.x !== b.x || c.y !== b.y) w0.setBounds(c);
	});
	w0.once('ready-to-show', () => {
		rendererReady = true;
		console.log('[viking] renderer ready');
		if (pendingShow) {
			const pending = pendingShow;
			pendingShow = null;
			show(pending.mode, pending.refineFrom);
		}
	});
	w0.loadFile('public/index.html');
	if (process.env.VIKING_DEVTOOLS) w0.webContents.openDevTools({ mode: 'detach' });
	w0.webContents.on('render-process-gone', (_e, d) => console.error('[viking] renderer gone:', d));
	w0.webContents.on('preload-error', (_e, p, err) => console.error('[viking] preload error:', p, err));
	w0.webContents.on('did-fail-load', (_e, code, desc) => console.error('[viking] load failed:', code, desc));
	return w0;
}

let settingsWin: BrowserWindow | null = null;
function openSettingsWindow(): void {
	if (settingsWin) {
		settingsWin.show();
		settingsWin.focus();
		return;
	}
	settingsWin = new BrowserWindow({
		width: 960, height: 680,
		minWidth: 760, minHeight: 560,
		resizable: true,
		title: 'viking settings',
		titleBarStyle: 'hiddenInset',
		trafficLightPosition: { x: 16, y: 16 },
		backgroundColor: '#0a0a0a',
		webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
	});
	settingsWin.loadFile('public/index.html', { query: { view: 'settings' } });
	if (process.env.VIKING_DEVTOOLS) settingsWin.webContents.openDevTools({ mode: 'detach' });
	settingsWin.on('closed', () => { settingsWin = null; });
}

async function captureScreen(): Promise<string | undefined> {
	try {
		const { width, height } = screen.getPrimaryDisplay().size;
		const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
		const img = sources[0]?.thumbnail;
		if (!img || img.isEmpty()) return undefined;
		return nativeImage.createFromBuffer(img.toJPEG(70)).toDataURL();
	} catch { return undefined; }
}

function show(mode: 'textbox' | 'followup', refineFrom?: Option): void {
	console.log('[viking] show request:', { mode, hasWindow: !!win, rendererReady, cwd: currentLaunch.cwd, activeFile: currentLaunch.activeFile });
	if (!win) win = createWindow();
	if (!rendererReady) {
		console.log('[viking] show queued until renderer is ready');
		pendingShow = { mode, refineFrom };
		return;
	}
	setMode('spotlight');
	console.log('[viking] showing window');
	win.show();
	app.focus({ steal: true }); // macOS: bring our app forward so the textarea gets keyboard input
	win.focus();
	win.webContents.send('viking:show', { mode, refineFrom });
}

function hide(): void {
	win?.hide();
	win?.webContents.send('viking:reset');
	lastOptions = [];
	activeIdx = 0;
	mode = 'full';
}

function friendly(err: Error): string {
	const m = err.message ?? String(err);
	if (!config.llm.apiKey) return 'No API key. Open model settings (⌘S) and enter an AI Gateway API key.';
	if (/ENOENT/.test(m) && /fff-mcp/.test(m)) return `fff-mcp not found at ${config.mcp.fff.command}. Install it, or edit electron/main/config.ts -> mcp.fff.command.`;
	if (/401|invalid_api_key|Incorrect API key|Unauthenticated/i.test(m)) return 'AI Gateway rejected the API key. Check it in model settings (⌘S).';
	if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(m)) return 'Could not reach Vercel AI Gateway. Check your connection.';
	if (/model.+(not_found|does not exist)/i.test(m)) return `Model "${config.llm.model}" is unavailable. Choose another model in settings (⌘S).`;
	if (/ZodError|Invalid|Expected/.test(m)) return 'Model returned malformed output. Try again, or choose a stronger model in settings (⌘S).';
	return m;
}

function buildPrompt(prompt: string | undefined, refineFrom?: Option): string | undefined {
	if (!refineFrom) return prompt;
	return [
		`Refining a previous suggestion.`,
		`Previous (${refineFrom.label}, ${refineFrom.language}):`,
		'```' + refineFrom.language, refineFrom.code, '```',
		`Follow-up from user: ${prompt ?? '(none — re-derive from screenshot)'}`,
	].join('\n');
}

async function run(prompt: string | undefined, refineFrom?: Option): Promise<void> {
	setMode('full');
	win?.webContents.send('viking:loading');
	const screenshot = await captureScreen();
	try {
		const { output, reasoning, softError } = await generate({
			agentType: 'code',
			userPrompt: buildPrompt(prompt, refineFrom) ?? '',
			screenshot: screenshot ?? '',
			launch: currentLaunch,
			onTool: event => win?.webContents.send('viking:tool', event),
		});
		const options = output?.options ?? [];
		lastOptions = options;
		activeIdx = 0;
		win?.webContents.send('viking:result', { options, reasoning, softError });
	} catch (e) {
		win?.webContents.send('viking:result', { options: [], error: friendly(e as Error) });
	}
}

app.whenReady().then(() => {
	console.log('[viking] app ready');
	loadSettings();
	win = createWindow();

	const registerOpen = () => globalShortcut.register(config.hotkeys.open, () => {
		if (lastOptions.length && win?.isVisible()) show('followup', lastOptions[activeIdx]);
		else show('textbox');
	});
	registerOpen();
	// close is window-scoped (handled in renderer keydown) — registering 'q' globally would steal it system-wide.

	if (currentLaunch.cwd) show('textbox');

	ipcMain.on('viking:submit', (_e, payload: { prompt: string; refineFrom?: Option }) => run(payload.prompt, payload.refineFrom));
	ipcMain.on('viking:setActive', (_e, idx: number) => { activeIdx = idx; });
	// Content-driven height in both modes; width and position stay put.
	ipcMain.on('viking:resize', (_e, height: number) => {
		if (!win) return;
		const b = win.getBounds();
		const area = screen.getPrimaryDisplay().workArea;
		const max = mode === 'spotlight'
			? 300
			: Math.min(840, (config.growth === 'up' ? b.y + b.height - area.y : area.height - b.y) - 24);
		const min = mode === 'spotlight' ? SIZES.spotlight.h : 160;
		const h = Math.min(Math.max(Math.ceil(height), min), max);
		// growth 'up': bottom edge stays put, window grows toward the top of the work area.
		const y = config.growth === 'up' ? b.y + b.height - h : b.y;
		win.setBounds(clampToWorkArea({ ...b, y, height: h }));
	});
	ipcMain.on('viking:hide', hide);
	ipcMain.on('viking:back', () => setMode('full')); // follow-up prompt back to results: spotlight is too narrow for them

	ipcMain.on('viking:openSettings', () => openSettingsWindow());
	ipcMain.handle('viking:getSettings', () => ({ llm: { ...config.llm }, hotkeys: { ...config.hotkeys }, theme: config.theme, growth: config.growth }));
	ipcMain.handle('viking:getModels', getGatewayModels);
	ipcMain.handle('viking:saveSettings', (e, s: Persisted) => {
		const prevOpen = config.hotkeys.open;
		saveSettings(s);
		if (s.hotkeys?.open && s.hotkeys.open !== prevOpen) {
			globalShortcut.unregister(prevOpen);
			registerOpen();
		}
		// Keep other windows (e.g. the overlay) live-updated; skip the sender to avoid an echo loop.
		const snap = { llm: { ...config.llm }, hotkeys: { ...config.hotkeys }, theme: config.theme, growth: config.growth };
		for (const w of BrowserWindow.getAllWindows()) if (w.webContents !== e.sender) w.webContents.send('viking:settings', snap);
	});
});

app.on('will-quit', () => {
	globalShortcut.unregisterAll();
	void closeMcpConnections();
});
app.on('window-all-closed', () => { /* overlay: stay alive */ });
