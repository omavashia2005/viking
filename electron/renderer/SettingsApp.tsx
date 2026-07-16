import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelPicker } from './components/ModelPicker';
import { THEMES, type Hotkeys, type LLM, type Theme } from './components/types';
import { Input } from './components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';

const PAGES = ['model', 'appearance', 'keybindings'] as const;
type Page = (typeof PAGES)[number];

const MICRO = 'text-[10.5px] lowercase tracking-[0.16em] text-muted-foreground';

const GLYPHS: Record<string, string> = {
  commandorcontrol: '⌘', command: '⌘', control: '⌃', alt: '⌥', shift: '⇧', escape: 'esc', space: 'space',
};
const glyph = (part: string): string =>
  GLYPHS[part.toLowerCase()] ?? (part.length === 1 ? part.toUpperCase() : part.toLowerCase());

// Display-only: 'CommandOrControl+S' → [⌘][S]. implicitMod prepends ⌘ (the copy binding).
function Keycaps({ binding, implicitMod }: { binding: string; implicitMod?: boolean }): JSX.Element | null {
  if (!binding) return null;
  const caps = [...(implicitMod ? ['⌘'] : []), ...binding.split('+').map(glyph)];
  return (
    <span className="flex shrink-0 gap-1" aria-hidden>
      {caps.map((cap, i) => (
        <kbd key={i} className="min-w-[20px] rounded border border-border bg-secondary px-1.5 py-1 text-center font-sans text-[10px] leading-none text-foreground">
          {cap}
        </kbd>
      ))}
    </span>
  );
}

const BINDINGS: { key: keyof Hotkeys; label: string; hint: string; options: string[]; implicitMod?: boolean }[] = [
  { key: 'open', label: 'open prompt', hint: 'global — works anywhere', options: ['CommandOrControl+I', 'CommandOrControl+Space', 'Alt+I'] },
  { key: 'settings', label: 'open settings', hint: 'this window', options: ['CommandOrControl+S', 'CommandOrControl+K', 'CommandOrControl+,', 'CommandOrControl+Shift+K'] },
  { key: 'close', label: 'close overlay', hint: 'ignored while typing', options: ['q', 'Escape'] },
  { key: 'copy', label: 'copy active result', hint: '⌘/ctrl + key', options: ['c', 'y', 'p'], implicitMod: true },
  { key: 'back', label: 'back to results', hint: 'from a follow-up prompt', options: ['CommandOrControl+Shift+B', 'CommandOrControl+Shift+O', 'Alt+ArrowLeft'] },
];

// keep a custom binding from a hand-edited config selectable
const withCurrent = (value: string, options: string[]): string[] =>
  value && !options.includes(value) ? [value, ...options] : options;

function PageHead({ title, sub }: { title: string; sub: string }): JSX.Element {
  return (
    <header className="flex flex-col gap-1.5 border-b border-border pb-5">
      <h1 className="m-0 text-[14px] font-medium lowercase tracking-[0.22em]">{title}</h1>
      <p className="m-0 text-[11px] lowercase text-muted-foreground">{sub}</p>
    </header>
  );
}

// A live miniature of the overlay, painted with the candidate theme's own tokens
// via the local data-theme scope. Click to apply.
function ThemeCard({ value, selected, onSelect }: { value: Theme; selected: boolean; onSelect: () => void }): JSX.Element {
  return (
    <button
      type="button"
      data-theme={value}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-[210px] flex-col gap-2.5 rounded-xl border bg-card p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-transparent ring-2 ring-ring' : 'border-border hover:border-foreground/30',
      )}
    >
      <span className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
        <Search className="shrink-0 text-muted-foreground" size={11} />
        <span className="text-[10px] italic leading-none text-muted-foreground">ask viking anything</span>
      </span>
      <span className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
        <span className="flex gap-1.5">
          <span className="rounded-[3px] bg-secondary px-1 py-0.5 text-[7.5px] lowercase leading-none text-foreground">⌘1 fix.ts</span>
          <span className="py-0.5 text-[7.5px] lowercase leading-none text-muted-foreground">⌘2 alt</span>
        </span>
        <span className="mt-1 block h-[3px] w-4/5 rounded-full bg-primary/70" />
        <span className="block h-[3px] w-3/5 rounded-full bg-foreground/30" />
        <span className="block h-[3px] w-2/3 rounded-full bg-foreground/15" />
      </span>
      <span className="px-0.5 text-[10.5px] lowercase tracking-[0.16em] text-foreground">{value}</span>
    </button>
  );
}

export default function SettingsApp(): JSX.Element {
  const [page, setPage] = useState<Page>('model'); // ⌘S used to land on the provider pane
  const [llm, setLlm] = useState<LLM>({ apiKey: '', model: '' });
  const [hotkeys, setHotkeys] = useState<Hotkeys>({ open: '', settings: '', close: '', copy: '', back: '' });
  const [theme, setTheme] = useState<Theme>('onyx');
  const [growth, setGrowth] = useState<'down' | 'up'>('down');
  const [saved, setSaved] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    if (!window.viking) {
      console.error('[viking] preload bridge missing — window.viking is undefined. Check preload path / contextIsolation.');
      return;
    }
    window.viking.getSettings().then(s => {
      setLlm(s.llm);
      setHotkeys(s.hotkeys);
      if (THEMES.includes(s.theme)) setTheme(s.theme);
      setGrowth(s.growth === 'up' ? 'up' : 'down');
      // mark ready after the populated state has flushed, so the autosave effect skips the load
      setTimeout(() => { ready.current = true; }, 0);
    });
  }, []);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // Autosave on change; main broadcasts 'viking:settings' to the other windows.
  useEffect(() => {
    if (!ready.current) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      await window.viking.saveSettings({ llm, hotkeys, theme, growth });
      if (!cancelled) { setSaved(true); setTimeout(() => setSaved(false), 1200); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [llm, hotkeys, theme, growth]);

  return (
    // --background is transparent for the overlay's sake; this window paints its own surface.
    <div className="flex h-screen flex-col bg-card text-foreground">
      {/* drag strip; leaves the top-left to the hiddenInset traffic lights */}
      <header className="flex h-[52px] shrink-0 items-center justify-end border-b border-border px-5 [-webkit-app-region:drag]">
        <span
          aria-live="polite"
          className={cn('text-[10.5px] lowercase tracking-[0.1em] text-primary transition-opacity duration-200 motion-reduce:transition-none', saved ? 'opacity-100' : 'opacity-0')}
        >
          ✓ saved
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="settings pages" className="flex w-44 shrink-0 flex-col gap-7 border-r border-border px-3.5 py-6">
          <div className="flex flex-col gap-0.5 px-2.5">
            <span className="text-[12px] font-bold lowercase tracking-[0.18em]">viking</span>
            <span className={MICRO}>settings</span>
          </div>
          <div className="flex flex-col gap-1">
            {PAGES.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                aria-current={page === p ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[11.5px] lowercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 motion-reduce:transition-none',
                  page === p ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className={cn('size-1 rounded-full', page === p ? 'bg-primary' : 'bg-transparent')} />
                {p}
              </button>
            ))}
          </div>
        </nav>

        <main className="spage min-h-0 flex-1 overflow-y-auto px-10 py-9">
          {page === 'model' && (
            <section className="flex max-w-xl flex-col gap-8">
              <PageHead title="model" sub="the model that answers, and the key that pays for it" />
              <ModelPicker value={llm.model} onChange={model => setLlm({ ...llm, model })} />
              <label className="flex flex-col gap-1.5">
                <span className={MICRO}>ai gateway api key</span>
                <Input
                  type="password"
                  value={llm.apiKey}
                  onChange={e => setLlm({ ...llm, apiKey: e.target.value })}
                  placeholder="AI_GATEWAY_API_KEY"
                  spellCheck={false}
                  className="bg-black/20 caret-primary"
                />
                <span className="text-[10px] lowercase text-muted-foreground">stored locally in viking-settings.json</span>
              </label>
            </section>
          )}

          {page === 'appearance' && (
            <section className="flex max-w-xl flex-col gap-8">
              <PageHead title="appearance" sub="themes apply to the overlay and this window, instantly" />
              <div className="flex flex-wrap gap-4">
                {THEMES.map(t => <ThemeCard key={t} value={t} selected={t === theme} onSelect={() => setTheme(t)} />)}
              </div>
              <div className="flex flex-col gap-2">
                <span className={MICRO}>expand</span>
                <div className="flex gap-2">
                  {([['down', 'below the bar'], ['up', 'above the bar']] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setGrowth(v)}
                      aria-pressed={growth === v}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-[11px] lowercase tracking-[0.08em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        growth === v ? 'border-transparent bg-secondary text-foreground ring-1 ring-ring' : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-[10px] lowercase text-muted-foreground">"above" suits a bar dragged to the bottom of the screen</span>
              </div>
            </section>
          )}

          {page === 'keybindings' && (
            <section className="flex max-w-xl flex-col gap-3">
              <PageHead title="keybindings" sub="how you summon and drive viking" />
              <div className="flex flex-col">
                {BINDINGS.map(b => (
                  <div key={b.key} className="flex items-center gap-4 border-b border-border py-4 last:border-b-0">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-[11.5px] lowercase">{b.label}</span>
                      <span className="text-[10px] lowercase text-muted-foreground">{b.hint}</span>
                    </div>
                    <Keycaps binding={hotkeys[b.key]} implicitMod={b.implicitMod} />
                    <Select value={hotkeys[b.key]} onValueChange={v => setHotkeys({ ...hotkeys, [b.key]: v })}>
                      <SelectTrigger className="w-52 shrink-0 lowercase" aria-label={b.label}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {withCurrent(hotkeys[b.key], b.options).map(o => (
                          <SelectItem key={o} value={o} className="lowercase">{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
