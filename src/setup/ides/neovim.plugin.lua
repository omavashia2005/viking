-- Viking plugin (managed by viking setup; safe to edit but constants are read by the setup script).
local M = {}

-- >>> viking-constants (do not edit by hand)
M.app_path = '__APP_PATH__'
M.keymap   = '__KEYMAP__'
-- <<< viking-constants

-- Stub: state machine + send action implemented in subtask 2.
vim.keymap.set('i', M.keymap, function()
  vim.notify('viking: not wired yet', vim.log.levels.INFO)
end, { desc = 'viking: send cwd + filename to app (stub)' })

return M
