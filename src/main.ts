import { app, BrowserWindow, globalShortcut, ipcMain, screen, desktopCapturer, nativeImage } from 'electron';
import path from 'node:path';
import { config } from './config';
import { generate } from './llm';

let win: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const w = 720, h = 460;
  const w0 = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round((width - w) / 2),
    y: Math.round(height * 0.18),
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    vibrancy: 'under-window',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
  });
  w0.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  w0.setAlwaysOnTop(true, 'screen-saver');
  w0.loadFile('public/index.html');
  return w0;
}

async function captureScreen(): Promise<string | undefined> {
  try {
    const { width, height } = screen.getPrimaryDisplay().size;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width, height } });
    const img = sources[0]?.thumbnail;
    if (!img || img.isEmpty()) return undefined;
    // ponytail: full-screen JPEG @ 70%. Shrink/crop if token cost matters.
    return nativeImage.createFromBuffer(img.toJPEG(70)).toDataURL();
  } catch {
    return undefined;
  }
}

function show(mode: 'textbox' | 'direct'): void {
  if (!win) win = createWindow();
  win.showInactive();
  win.focus();
  win.webContents.send('viking:show', { mode });
}

function hide(): void {
  win?.hide();
  win?.webContents.send('viking:reset');
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

async function run(userPrompt: string | undefined): Promise<void> {
  win?.webContents.send('viking:loading');
  const screenshot = await captureScreen();
  try {
    const options = await generate(userPrompt, screenshot);
    win?.webContents.send('viking:result', { options });
  } catch (e) {
    win?.webContents.send('viking:result', { options: [], error: friendly(e as Error) });
  }
}

app.whenReady().then(() => {
  win = createWindow();

  globalShortcut.register(config.hotkeys.direct, () => { show('direct'); run(undefined); });
  globalShortcut.register(config.hotkeys.withTextbox, () => show('textbox'));
  globalShortcut.register(config.hotkeys.close, hide);

  ipcMain.on('viking:submit', (_e, prompt: string) => run(prompt));
  ipcMain.on('viking:hide', hide);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { /* overlay: stay alive */ });
