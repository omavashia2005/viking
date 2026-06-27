import { app, BrowserWindow } from 'electron';

let win: BrowserWindow | null;

function createWindow(): void {
  win = new BrowserWindow({ width: 1200, height: 800 });
  win.loadFile('public/index.html');
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (win === null) createWindow();
});
