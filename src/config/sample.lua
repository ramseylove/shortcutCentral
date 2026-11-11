-- A sample config. Replace it with your own init.lua, then press Apply.
vim.g.mapleader = ','
vim.g.maplocalleader = '\\'

vim.opt.number = true
vim.opt.relativenumber = true

-- Mappings with a description become items in the "My config" pack.
vim.keymap.set('n', '<leader>w', '<cmd>write<cr>', { desc = 'Save the file' })
vim.keymap.set('n', '<leader>q', '<cmd>quit<cr>', { desc = 'Close the window' })
vim.keymap.set('n', '<Esc>', '<cmd>nohlsearch<cr>', { desc = 'Clear search highlighting' })
vim.keymap.set('v', '<leader>y', '"+y', { desc = 'Copy the selection to the system clipboard' })

-- No description and a function on the right: reported as a warning.
vim.keymap.set('n', '<leader>x', function() vim.notify('hello') end)

-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath('data') .. '/lazy/lazy.nvim'
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  vim.fn.system({ 'git', 'clone', '--filter=blob:none', 'https://github.com/folke/lazy.nvim.git', lazypath })
end
vim.opt.rtp:prepend(lazypath)

require('lazy').setup({
  {
    'nvim-telescope/telescope.nvim',
    dependencies = {
      'nvim-lua/plenary.nvim',
      { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' },
    },
    config = function()
      require('telescope').setup({})
      require('telescope').load_extension('fzf')
      local builtin = require('telescope.builtin')
      -- These replace the suggested keys in the Telescope pack.
      vim.keymap.set('n', '<leader>sf', builtin.find_files, { desc = 'Search files' })
      vim.keymap.set('n', '<leader>sg', builtin.live_grep, { desc = 'Search by grep' })
      vim.keymap.set('n', '<leader><leader>', builtin.buffers, { desc = 'Find open buffers' })
    end,
  },
  {
    'lewis6991/gitsigns.nvim',
    opts = {
      on_attach = function(bufnr)
        local gitsigns = require('gitsigns')
        local function map(mode, lhs, rhs, desc)
          vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
        end
        map('n', ']h', function() gitsigns.nav_hunk('next') end, 'Next hunk')
        map('n', '[h', function() gitsigns.nav_hunk('prev') end, 'Previous hunk')
        map('n', '<leader>gs', gitsigns.stage_hunk, 'Stage hunk')
        map('n', '<leader>gp', gitsigns.preview_hunk, 'Preview hunk')
      end,
    },
  },
  { 'folke/which-key.nvim', event = 'VeryLazy' },
  { 'nvim-neo-tree/neo-tree.nvim', keys = { { '<leader>e', '<cmd>Neotree toggle<cr>', desc = 'Toggle the file tree' } } },
})
