import type { Context } from './shared-types';
import { config } from './config';

// One place for prompts. Edit phrasing here, not at the call site.
export const prompts = {
  system: `You are a coding-snippet generator embedded in a floating overlay.
Return exactly ${config.numOptions} distinct, idiomatic ways to write the snippet the user wants.
Each option must be runnable code only — no prose, no comments unless idiomatic, no markdown fences.
Vary the approach across options (e.g. naive vs. stdlib vs. third-party vs. one-liner). Prefer the language the user appears to be using.
Return JSON matching the provided schema; "code" is the snippet, "label" is a 1-3 word identifier of the approach.`,

  user: (ctx: Context) => {
    const parts: string[] = [];
    if (ctx.userPrompt) parts.push(`Request:\n${ctx.userPrompt}`);
    else parts.push(`No explicit prompt. Infer the desired snippet from the screenshot and the surrounding code.`);
    parts.push(`Target language (best guess): ${ctx.language}`);
    if (ctx.docs) parts.push(`Relevant docs:\n${ctx.docs.slice(0, 4000)}`);
    if (ctx.codebase) parts.push(`Relevant code from the user's project:\n${ctx.codebase.slice(0, 4000)}`);
    return parts.join('\n\n');
  },
};
