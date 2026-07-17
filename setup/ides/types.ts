export const ideIds = ['neovim', 'vscode'] as const;
export type IdeId = (typeof ideIds)[number];
export type LaunchSource = IdeId | 'general';

export function normalizeLaunchSource(source?: string): LaunchSource {
	return ideIds.find(id => id === source) ?? 'general';
}

export interface Ide {
	id: IdeId;
	name: string;
	// null = no config detected on this machine; setup skips gracefully.
	locateConfig(): { dir: string; entryFile: string } | null;
	pluginPath(configDir: string): string;
	entryRequire: string; // line to add into the init/entry file
}
