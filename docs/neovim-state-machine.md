# Neovim plugin state machine

The Viking neovim plugin tracks the editor's lifecycle so the send keymap
(`<leader>vo` by default) only fires when the user is actively typing in a
real buffer. Insert-mode is the trigger window; everything else is bookkeeping.

```mermaid
stateDiagram-v2
    [*] --> opened: BufEnter (1st real buffer)
    opened --> multi: BufEnter (2nd+ real buffer)
    multi --> multi: BufEnter (another real buffer)
    opened --> received: InsertEnter
    multi --> received: InsertEnter
    received --> escaped: InsertLeave
    escaped --> opened: BufEnter (1 buffer seen)
    escaped --> multi: BufEnter (2+ buffers seen)
    received --> received: keymap fires (send cwd+file, stay)
    received --> quit: VimLeavePre
    quit --> [*]

    state "multiple files open" as multi
```

| State                  | Entry trigger                                  |
|------------------------|------------------------------------------------|
| `opened`               | `BufEnter` on the first real buffer            |
| `multiple files open`  | `BufEnter` on a 2nd+ real buffer               |
| `received`             | `InsertEnter` from `opened` or `multi`         |
| `escaped`              | `InsertLeave` from `received`                  |
| `quit`                 | `VimLeavePre` from `received`                  |

"Real buffer" = `vim.bo.buftype == ''` (skips quickfix, help, terminal, etc.).
The send keymap is registered in insert mode and only acts when state is
`received`; it stays in `received` after firing so the user can send again
without leaving insert mode.
