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

async function run(userPrompt: string | undefined): Promise<void> {
  win?.webContents.send('viking:loading');
  const screenshot = await captureScreen();
  try {
    const options = await generate(userPrompt, screenshot);
    win?.webContents.send('viking:result', { options });
  } catch (e) {
    win?.webContents.send('viking:result', { options: [], error: (e as Error).message });
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
