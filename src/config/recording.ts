/** What running a config recorded. Produced by `prelude.lua`. */
export interface RecordedMapping {
  modes: string[];
  lhs: string;
  /** Right-hand side when it is a string, e.g. `<cmd>Telescope find_files<cr>`. */
  rhs?: string;
  /** Plugin functions and commands the right-hand side refers to, when it is a function. */
  refs?: string[];
  desc?: string;
  /** Plugin spec the mapping came from, for lazy.nvim `keys`. */
  origin?: string;
  line?: number;
}

export interface RecordedWarning {
  message: string;
  line?: number;
}

export interface Recording {
  leader?: string;
  localleader?: string;
  /** Repositories from lazy.nvim plugin specs, e.g. `nvim-telescope/telescope.nvim`. */
  plugins: string[];
  mappings: RecordedMapping[];
  warnings: RecordedWarning[];
  /** Set when the config stopped with an error; everything recorded before it is kept. */
  error?: { message: string; line?: number };
}

/** Longest a config may run before it is stopped. */
export const CONFIG_TIME_LIMIT_MS = 2000;
