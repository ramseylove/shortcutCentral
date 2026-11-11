// @vitest-environment node
import { LuaFactory } from 'wasmoon';
import { describe, expect, it } from 'vitest';
import { parseKeys } from '../keys/notation';
import { packSchema } from '../packs/schema';
import { recordConfig } from './recordConfig';
import type { Recording } from './recording';
import { mappingRefs, normaliseLhs, resolveConfig } from './resolve';
import sampleConfig from './sample.lua?raw';

const empty: Recording = { plugins: [], mappings: [], warnings: [] };
const resolve = (recording: Partial<Recording>) => resolveConfig('neovim', { ...empty, ...recording });

describe('normaliseLhs', () => {
  it('puts keys into canonical notation', () => {
    expect(normaliseLhs('<Leader>ff')).toEqual({ keys: '<leader>ff' });
    expect(normaliseLhs(' w')).toEqual({ keys: '<Space>w' });
    expect(normaliseLhs('<c-p>')).toEqual({ keys: '<C-p>' });
    expect(normaliseLhs('<A-j>')).toEqual({ keys: '<M-j>' });
  });

  it('rejects keys that cannot be typed in the app', () => {
    expect(normaliseLhs('<Plug>(leap)')).toHaveProperty('problem');
    expect(normaliseLhs('<ScrollWheelUp>')).toHaveProperty('problem');
    expect(normaliseLhs('<D-s>')).toHaveProperty('problem');
  });
});

describe('mappingRefs', () => {
  const refs = (rhs: string) => mappingRefs({ modes: ['n'], lhs: 'x', rhs });
  it('reads commands and Lua calls out of string mappings', () => {
    expect(refs('<cmd>Telescope find_files<CR>')).toEqual(['Telescope find_files']);
    expect(refs(':Gitsigns  stage_hunk<cr>')).toEqual(['Gitsigns stage_hunk']);
    expect(refs("<cmd>lua require('telescope.builtin').live_grep()<cr>")).toContain('telescope.builtin.live_grep');
    expect(refs(`<cmd>lua require("gitsigns").nav_hunk("next")<cr>`).slice(0, 2)).toEqual([
      "gitsigns.nav_hunk('next')",
      'gitsigns.nav_hunk',
    ]);
  });
});

describe('resolveConfig', () => {
  it("uses Neovim's default leader when the config sets none", () => {
    const result = resolve({});
    expect(result.leader).toEqual({ keys: '\\', fromConfig: false });
    expect(result.active.placeholders.leader).toBe('\\');
    expect(resolve({ leader: ' ' }).leader).toEqual({ keys: '<Space>', fromConfig: true });
  });

  it('rule 1: replaces the keys of a pack item whose match list names the right-hand side', () => {
    const result = resolve({
      mappings: [
        { modes: ['n'], lhs: '<leader>sf', refs: ['telescope.builtin.find_files'], desc: 'Search files' },
        { modes: ['n'], lhs: '<C-p>', rhs: '<cmd>Telescope find_files<cr>' },
        { modes: ['n'], lhs: '<leader>hD', refs: ["gitsigns.diffthis('~')", 'gitsigns.diffthis'] },
      ],
    });
    expect(result.active.overrides.get('neovim/telescope/find-files')).toEqual(['<leader>sf', '<C-p>']);
    // The call with its argument wins over the bare function.
    expect(result.active.overrides.has('neovim/gitsigns/diff-last-commit')).toBe(true);
    expect(result.active.overrides.has('neovim/gitsigns/diff-index')).toBe(false);
    expect(result.ownMappings).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('rule 2: described mappings become a valid My config pack with stable ids', () => {
    const mappings = Array.from({ length: 10 }, (_, i) => ({
      modes: ['n'],
      lhs: `<leader>${i}`,
      rhs: `:echo ${i}<cr>`,
      desc: i < 2 ? 'Do the thing!' : `Thing ${i}`,
    }));
    mappings.push({ modes: ['v'], lhs: '<leader>y', rhs: '"+y', desc: 'Copy' });
    mappings.push({ modes: ['v'], lhs: '<leader>y', rhs: '"+y', desc: 'Copy' });
    const pack = resolve({ mappings }).active.myPack!;
    // Valid as a pack apart from the two things only the app may set.
    const asFile = {
      ...pack,
      id: 'mine',
      lessons: pack.lessons.map((l) => ({ ...l, items: l.items.map((i) => ({ ...i, source: 'default' })) })),
    };
    expect(packSchema.safeParse(asFile).success).toBe(true);
    expect(packSchema.safeParse(pack).success).toBe(false);
    expect(pack.lessons.map((l) => l.items.length)).toEqual([8, 3]);
    const items = pack.lessons.flatMap((l) => l.items);
    expect(items.slice(0, 2).map((i) => i.id)).toEqual(['do-the-thing', 'do-the-thing-2']);
    expect(items.at(-1)).toMatchObject({ id: 'copy', prompt: 'Copy (visual mode)', keys: ['<leader>y'], source: 'config' });
  });

  it('rule 3: warns about mappings with nothing to make a prompt from', () => {
    const result = resolve({
      mappings: [
        { modes: ['n'], lhs: '<leader>x', refs: [], line: 7 },
        { modes: ['n'], lhs: 'j', rhs: 'gj' },
        { modes: ['n'], lhs: '<Plug>(x)', rhs: 'y' },
      ],
    });
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatchObject({ line: 7 });
    expect(result.warnings[0].message).toContain('Lua function');
  });

  it('matches plugins to packs by repository', () => {
    const result = resolve({ plugins: ['nvim-telescope/telescope.nvim', 'folke/which-key.nvim'] });
    expect(result.plugins).toEqual([
      { repo: 'nvim-telescope/telescope.nvim', packId: 'telescope', packName: 'Telescope' },
      { repo: 'folke/which-key.nvim' },
    ]);
  });

  it('the sample config changes the leader, enables packs and overrides Telescope mappings', async () => {
    const result = resolveConfig('neovim', await recordConfig(sampleConfig, new LuaFactory()));
    expect(result.error).toBeUndefined();
    expect(result.leader.keys).toBe(',');
    expect(result.plugins.filter((p) => p.packId).map((p) => p.packId)).toEqual(['telescope', 'telescope-fzf-native', 'gitsigns', 'neo-tree']);
    expect(result.active.overrides.get('neovim/telescope/find-files')).toEqual(['<leader>sf']);
    expect(result.active.overrides.get('neovim/telescope/buffers')).toEqual(['<leader><leader>']);
    expect(result.active.overrides.get('neovim/gitsigns/next-hunk')).toEqual([']h']);
    expect(result.overrides).toHaveLength(7);
    expect(result.ownMappings).toBe(5);
    expect(result.warnings).toHaveLength(1);
    // Every key the config produced can be typed.
    for (const keys of result.active.overrides.values()) expect(parseKeys(keys[0]).length).toBeGreaterThan(0);
  });
});
