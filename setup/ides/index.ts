import { neovim } from './neovim/neovim';
import type { Ide } from './types';

// Extension point: add more IDE adapters here. Only neovim wired up for now.
export const ides: Ide[] = [neovim];
