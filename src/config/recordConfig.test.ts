// @vitest-environment node
import { LuaFactory } from 'wasmoon';
import { describe, expect, it } from 'vitest';
import { recordConfig } from './recordConfig';
import sampleConfig from './sample.lua?raw';

const factory = new LuaFactory();
const run = (source: string) => recordConfig(source, factory);

describe('recordConfig', () => {
  it('records the leader keys', async () => {
    const rec = await run(`vim.g.mapleader = ','\nvim.g.maplocalleader = ' '`);
    expect(rec.leader).toBe(',');
    expect(rec.localleader).toBe(' ');
    expect(rec.error).toBeUndefined();
  });

  it('records string, function-reference and wrapped-function mappings', async () => {
    const rec = await run(`
      local builtin = require('telescope.builtin')
      vim.keymap.set('n', '<leader>sf', builtin.find_files, { desc = 'Search files' })
      vim.keymap.set('n', '<leader>sg', '<cmd>Telescope live_grep<cr>')
      vim.keymap.set({ 'n', 'v' }, '<leader>sb', function()
        builtin.buffers(require('telescope.themes').get_dropdown({ previewer = false }))
      end)
      vim.keymap.set('n', ']c', function()
        if vim.wo.diff then vim.cmd.normal({ ']c', bang = true }) else require('gitsigns').nav_hunk('next') end
      end)
    `);
    expect(rec.mappings).toEqual([
      { modes: ['n'], lhs: '<leader>sf', refs: ['telescope.builtin.find_files'], desc: 'Search files', line: 3 },
      { modes: ['n'], lhs: '<leader>sg', rhs: '<cmd>Telescope live_grep<cr>', line: 4 },
      {
        modes: ['n', 'v'],
        lhs: '<leader>sb',
        refs: ['telescope.themes.get_dropdown', 'telescope.builtin.buffers'],
        line: 5,
      },
      { modes: ['n'], lhs: ']c', refs: ["gitsigns.nav_hunk('next')", 'gitsigns.nav_hunk'], line: 8 },
    ]);
  });

  it('reads lazy.nvim specs: plugins, dependencies, keys and config callbacks', async () => {
    const rec = await run(`
      local lazypath = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'
      if not (vim.uv or vim.loop).fs_stat(lazypath) then error('would clone') end
      vim.opt.rtp:prepend(lazypath)
      require('lazy').setup({
        'tpope/vim-sleuth',
        {
          'nvim-telescope/telescope.nvim',
          dependencies = { 'nvim-lua/plenary.nvim', { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' } },
          keys = {
            { '<leader>ff', '<cmd>Telescope find_files<cr>', desc = 'Find files' },
            '<leader>fx',
          },
          config = function()
            require('telescope').setup({})
            vim.keymap.set('n', '<leader>fh', require('telescope.builtin').help_tags)
          end,
        },
        {
          'lewis6991/gitsigns.nvim',
          opts = {
            on_attach = function(bufnr)
              local gs = package.loaded.gitsigns
              vim.keymap.set('n', '<leader>gs', gs.stage_hunk, { buffer = bufnr })
            end,
          },
        },
        { 'folke/which-key.nvim', enabled = false },
        { import = 'plugins' },
      })
    `);
    expect(rec.error).toBeUndefined();
    expect(rec.plugins).toEqual([
      'tpope/vim-sleuth',
      'nvim-telescope/telescope.nvim',
      'nvim-lua/plenary.nvim',
      'nvim-telescope/telescope-fzf-native.nvim',
      'lewis6991/gitsigns.nvim',
    ]);
    expect(rec.mappings.map((m) => [m.lhs, m.rhs ?? m.refs])).toEqual([
      ['<leader>ff', '<cmd>Telescope find_files<cr>'],
      ['<leader>fh', ['telescope.builtin.help_tags']],
      ['<leader>gs', ['gitsigns.stage_hunk']],
    ]);
    expect(rec.mappings[0].origin).toBe('nvim-telescope/telescope.nvim');
    expect(rec.warnings).toHaveLength(1);
    expect(rec.warnings[0].message).toContain('"plugins"');
  });

  it('runs gitsigns on_attach passed to setup, and autocommand callbacks', async () => {
    const rec = await run(`
      require('gitsigns').setup({
        on_attach = function(bufnr)
          local gitsigns = require('gitsigns')
          local function map(mode, l, r, opts)
            opts = opts or {}
            opts.buffer = bufnr
            vim.keymap.set(mode, l, r, opts)
          end
          map('n', '<leader>hp', gitsigns.preview_hunk)
          map('n', '<leader>hD', function() gitsigns.diffthis('~') end)
        end,
      })
      vim.api.nvim_create_autocmd('LspAttach', {
        callback = function(event)
          vim.keymap.set('n', 'grn', vim.lsp.buf.rename, { buffer = event.buf, desc = 'Rename symbol' })
        end,
      })
    `);
    expect(rec.mappings.map((m) => [m.lhs, m.refs])).toEqual([
      ['<leader>hp', ['gitsigns.preview_hunk']],
      ['<leader>hD', ["gitsigns.diffthis('~')", 'gitsigns.diffthis']],
      ['grn', ['vim.lsp.buf.rename']],
    ]);
  });

  it('reads vimscript map commands passed to vim.cmd', async () => {
    const rec = await run(`vim.cmd([[
      colorscheme habamax
      nnoremap <silent> <leader>w :write<CR>
      map Q gq
    ]])`);
    expect(rec.mappings.map((m) => [m.modes, m.lhs, m.rhs])).toEqual([
      [['n'], '<leader>w', ':write<CR>'],
      [['n', 'v', 'o'], 'Q', 'gq'],
    ]);
  });

  it('keeps what was recorded before a runtime error, with its line', async () => {
    const rec = await run(`vim.g.mapleader = ' '\nvim.keymap.set('n', 'x', 'y')\nlocal t = nil\nprint(t.field)\nvim.keymap.set('n', 'a', 'b')`);
    expect(rec.error?.line).toBe(4);
    expect(rec.error?.message).toMatch(/nil value/);
    expect(rec.leader).toBe(' ');
    expect(rec.mappings).toHaveLength(1);
  });

  it('reports a syntax error with its line', async () => {
    const rec = await run(`vim.g.mapleader = ' '\nlocal = 3`);
    expect(rec.error?.line).toBe(2);
    expect(rec.mappings).toHaveLength(0);
  });

  it('accepts Lua 5.1 names and has no file access', async () => {
    const rec = await run(`
      local a, b = unpack({ 1, 2 })
      assert(loadstring('return 1')() == 1)
      assert(io.open('/etc/passwd') == nil)
      assert(os.getenv('HOME') == nil)
      local ok = pcall(require, 'my.own.module')
      assert(ok)
      require('my.own.module').anything.at.all({ 1 }):chain()
      for _ in ipairs(require('something')) do error('proxy must not iterate') end
    `);
    expect(rec.error).toBeUndefined();
  });

  it('stops a config that never finishes', async () => {
    const rec = await run(`vim.g.mapleader = ','\nwhile true do end`);
    expect(rec.error).toBeDefined();
    expect(rec.leader).toBe(',');
  }, 10_000);

  it('handles the sample config', async () => {
    const rec = await run(sampleConfig);
    expect(rec.error).toBeUndefined();
    expect(rec.leader).toBe(',');
    expect(rec.plugins).toContain('nvim-telescope/telescope.nvim');
    expect(rec.plugins).toContain('lewis6991/gitsigns.nvim');
  });
});
