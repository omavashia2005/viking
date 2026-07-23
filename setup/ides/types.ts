import { z } from 'zod';

export const IdeId = z.enum(['neovim', 'vscode']);
export type IdeId = z.infer<typeof IdeId>;
export const ideIds = IdeId.options;

export const LaunchSource = z.union([IdeId, z.literal('general')]);
export type LaunchSource = z.infer<typeof LaunchSource>;

export const normalizeLaunchSource = (source?: string): LaunchSource =>
	LaunchSource.safeParse(source).data ?? 'general';

export interface Ide {
	id: IdeId;
	name: string;
	// null = no config detected on this machine; setup skips gracefully.
	locateConfig(): { dir: string; entryFile: string } | null;
	pluginPath(configDir: string): string;
	entryRequire: string; // line to add into the init/entry file
}
