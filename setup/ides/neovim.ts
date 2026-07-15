import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Ide } from './types';

function nvimDir(): string {
	const xdg = process.env.XDG_CONFIG_HOME;
	return xdg ? path.join(xdg, 'nvim') : path.join(os.homedir(), '.config', 'nvim');
}

export const neovim: Ide = {
	id: 'neovim',
	name: 'Neovim',
	locateConfig() {
		const dir = nvimDir();
		const entryFile = path.join(dir, 'init.lua');
		return fs.existsSync(entryFile) ? { dir, entryFile } : null;
	},
	pluginPath(configDir) {
		return path.join(configDir, 'lua', 'viking_overlay.lua');
	},
	entryRequire: "require('viking_overlay')",
};
