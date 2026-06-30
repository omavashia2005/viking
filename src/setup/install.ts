import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ides } from './ides';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARD_START = '-- >>> viking';
const GUARD_END = '-- <<< viking';

function runBuild(): void {
  console.log('[viking-setup] running `npm run dist`...');
  const r = spawnSync('npm', ['run', 'dist'], { cwd: REPO_ROOT, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('[viking-setup] build failed');
    process.exit(r.status ?? 1);
  }
}

function resolveAppPath(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  const productName: string = pkg.build?.productName ?? pkg.name;
  const outDir: string = pkg.build?.directories?.output ?? 'dist';
  // electron-builder --mac --dir lands at <out>/mac-arm64 on Apple Silicon, mac on Intel.
  const candidates = ['mac-arm64', 'mac', 'mac-x64'].map(d =>
    path.join(REPO_ROOT, outDir, d, `${productName}.app`),
  );
  const found = candidates.find(fs.existsSync);
  if (!found) {
    console.error('[viking-setup] could not find .app under', path.join(REPO_ROOT, outDir));
    process.exit(1);
  }
  return found;
}

function renderStub(appPath: string, keymap: string): string {
  return `-- Viking plugin (managed by viking setup; safe to edit but constants are read by the setup script).
local M = {}

-- >>> viking-constants (do not edit by hand)
M.app_path = '${appPath}'
M.keymap   = '${keymap}'
-- <<< viking-constants

-- Stub: Agent C fills in the state machine + send action here.
-- For now, register a no-op keymap so setup is testable end-to-end.
vim.keymap.set('i', M.keymap, function()
  vim.notify('viking: not wired yet (Agent C TODO)', vim.log.levels.INFO)
end, { desc = 'viking: send cwd + filename to app (stub)' })

return M
`;
}

function patchInit(entryFile: string, entryRequire: string): void {
  const block = `${GUARD_START}\n-- managed by viking setup\n${entryRequire}\n${GUARD_END}`;
  const cur = fs.existsSync(entryFile) ? fs.readFileSync(entryFile, 'utf8') : '';
  const startIdx = cur.indexOf(GUARD_START);
  const endIdx = cur.indexOf(GUARD_END);
  let next: string;
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    next = cur.slice(0, startIdx) + block + cur.slice(endIdx + GUARD_END.length);
  } else {
    next = cur + (cur.endsWith('\n') || cur === '' ? '' : '\n') + '\n' + block + '\n';
  }
  fs.writeFileSync(entryFile, next);
}

function main(): void {
  runBuild();
  const appPath = resolveAppPath();

  // ponytail: first registered IDE wins. UI-side this is neovim-only; the array is the extension seam.
  const ide = ides[0];
  const loc = ide.locateConfig();
  if (!loc) {
    console.log(`[viking-setup] no ${ide.name} config found at ~/.config/nvim — install neovim or create init.lua`);
    process.exit(0);
  }

  const keymap = process.env.VIKING_KEYMAP || '<leader>vo';
  const pluginFile = ide.pluginPath(loc.dir);

  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(pluginFile, renderStub(appPath, keymap));
  patchInit(loc.entryFile, ide.entryRequire);

  console.log('[viking-setup] done.');
  console.log('  app:     ', appPath);
  console.log('  plugin:  ', pluginFile);
  console.log('  init.lua:', loc.entryFile);
  console.log('  keymap:  ', keymap, '(override with VIKING_KEYMAP)');
}

main();
