import os from 'node:os';
import path from 'node:path';

// All knobs live here. Edit me, don't bury settings in the rest of the code.
export const config = {
	hotkeys: {
		open: process.argv.includes('--viking-dev') ? 'CommandOrControl+Shift+L' : 'CommandOrControl+L',
		settings: 'CommandOrControl+S', // window-scoped; opens the settings window
		close: 'q',                     // window-scoped; ignored while typing in an input
		copy: 'c',                      // window-scoped: ⌘/Ctrl + this key copies the active option
		back: 'CommandOrControl+Shift+B', // window-scoped; returns from a follow-up prompt to the results
	},
	llm: {
		apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
		model: process.env.LLM_MODEL ?? 'anthropic/claude-opus-4.8',
	},
	connectors: {
		exa: {
			apiKey: process.env.EXA_API_KEY ?? '',
		},
		composio: {
			apiKey: process.env.COMPOSIO_API_KEY ?? '',
		},
	},
	theme: 'onyx', // overlay theme; see electron/renderer/themes.css for the available blocks
	growth: 'down' as 'down' | 'up', // which way the overlay grows from the bar; 'up' suits a bottom-of-screen placement
	mcp: {
		fff: { command: path.join(os.homedir(), '.local/bin/fff-mcp'), args: [] as string[] },
		context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
	},
	cwd: process.env.VIKING_CWD ?? process.cwd(),
};
