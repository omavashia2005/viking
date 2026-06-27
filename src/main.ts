import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config';
import { generate } from './llm';
import type { Option } from './shared-types';

const settingsFile = () => path.join(app.getPath('userData'), 'viking-settings.json');
// ponytail: plaintext api key on disk under the user's app data. Swap for keytar if shared machines matter.
type Persisted = { llm?: Partial<typeof config.llm>; hotkeys?: Partial<typeof config.hotkeys> };
function loadSettings(): void {
  try {
    const j: Persisted = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (j.llm) Object.assign(config.llm, j.llm);
    if (j.hotkeys) Object.assign(config.hotkeys, j.hotkeys);
  } catch {}
}
function saveSettings(s: Persisted): void {
  if (s.llm) Object.assign(config.llm, s.llm);
  if (s.hotkeys) Object.assign(config.hotkeys, s.hotkeys);
  fs.writeFileSync(settingsFile(), JSON.stringify({ llm: config.llm, hotkeys: config.hotkeys }, null, 2));
}

let win: BrowserWindow | null = null;
let lastOptions: Option[] = [];
let activeIdx = 0;
let mode: 'spotlight' | 'full' = 'full';

const SIZES = {
  spotlight: { w: 600, h: 64, y: 80 },
  full: { w: 720, h: 460, y: 16 },
};

// Resize only when switching modes; if the user dragged the window bigger in 'full', keep it.
function setMode(next: 'spotlight' | 'full'): void {
  if (!win || mode === next) return;
  mode = next;
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const { w, h, y } = SIZES[next];
  win.setBounds({ x: Math.round((width - w) / 2), y, width: w, height: h });
}

function createWindow(): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize;
  const { w, h, y } = SIZES.full;
  const w0 = new BrowserWindow({
    width: w, height: h, minWidth: 420, minHeight: 64,
    x: Math.round((width - w) / 2), y,
    transparent: true, frame: false, resizable: true, movable: true,
    alwaysOnTop: true, skipTaskbar: true, hasShadow: false, show: false,
    vibrancy: 'under-window',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  w0.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w0.setAlwaysOnTop(true, 'screen-saver');
  w0.loadFile('public/index.html');
  if (process.env.VIKING_DEVTOOLS) w0.webContents.openDevTools({ mode: 'detach' });
  w0.webContents.on('render-process-gone', (_e, d) => console.error('[viking] renderer gone:', d));
  w0.webContents.on('preload-error', (_e, p, err) => console.error('[viking] preload error:', p, err));
  w0.webContents.on('did-fail-load', (_e, code, desc) => console.error('[viking] load failed:', code, desc));
  return w0;
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
  if (!win) win = createWindow();
  setMode('spotlight');
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
  if (!config.llm.apiKey) return 'No API key. Set LLM_API_KEY (or OPENAI_API_KEY) in your shell and restart.';
  if (/ENOENT/.test(m) && /fff-mcp/.test(m)) return `fff-mcp not found at ${config.mcp.fff.command}. Install it, or edit src/config.ts → mcp.fff.command.`;
  if (/401|invalid_api_key|Incorrect API key/i.test(m)) return 'API key was rejected. Check LLM_API_KEY and LLM_BASE_URL match the same provider.';
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(m)) return `Could not reach ${config.llm.baseURL}. Check the URL and your connection.`;
  if (/model.+(not_found|does not exist)/i.test(m)) return `Model "${config.llm.model}" not available on this endpoint. Set LLM_MODEL to one your provider supports.`;
  if (/ZodError|Invalid|Expected/.test(m)) return 'Model returned malformed output. Try again, or switch LLM_MODEL to a stronger model.';
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
    const options = await generate(buildPrompt(prompt, refineFrom), screenshot);
    lastOptions = options;
    activeIdx = 0;
    win?.webContents.send('viking:result', { options });
  } catch (e) {
    win?.webContents.send('viking:result', { options: [], error: friendly(e as Error) });
  }
}

app.whenReady().then(() => {
  loadSettings();
  win = createWindow();

  const registerOpen = () => globalShortcut.register(config.hotkeys.open, () => {
    if (lastOptions.length && win?.isVisible()) show('followup', lastOptions[activeIdx]);
    else show('textbox');
  });
  registerOpen();
  // close is window-scoped (handled in renderer keydown) — registering 'q' globally would steal it system-wide.

  ipcMain.on('viking:submit', (_e, payload: { prompt: string; refineFrom?: Option }) => run(payload.prompt, payload.refineFrom));
  ipcMain.on('viking:setActive', (_e, idx: number) => { activeIdx = idx; });
  ipcMain.on('viking:resize', (_e, height: number) => {
    if (!win) return;
    const b = win.getBounds();
    if (height <= b.height) return; // only grow — preserves user-resize
    const max = screen.getPrimaryDisplay().workAreaSize.height - 40;
    win.setBounds({ ...b, height: Math.min(Math.ceil(height), max) });
  });
  ipcMain.on('viking:hide', hide);
  ipcMain.handle('viking:getSettings', () => ({ llm: { ...config.llm }, hotkeys: { ...config.hotkeys } }));
  ipcMain.handle('viking:saveSettings', (_e, s: Persisted) => {
    const prevOpen = config.hotkeys.open;
    saveSettings(s);
    if (s.hotkeys?.open && s.hotkeys.open !== prevOpen) {
      globalShortcut.unregister(prevOpen);
      registerOpen();
    }
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* overlay: stay alive */ });
