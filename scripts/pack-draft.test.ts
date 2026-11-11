// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { packSchema } from '../src/packs/schema';
import { citationHolds, parseDraft, renderDraft } from './pack-draft';

const docs = [{ path: 'README.md', lines: ['# Plugin', '', '| `a` | add a file |', '| `d` | delete |'] }];

const reply = (items: unknown[]) =>
  '```json\n' +
  JSON.stringify({ id: 'plugin', app: 'neovim', name: 'Plugin', version: 1, repo: 'o/plugin', lessons: [{ id: 'files', title: 'Files', items }] }) +
  '\n```';

const add = {
  id: 'add-file',
  type: 'keys',
  action: 'plugin.add',
  prompt: 'Add a file',
  keys: ['a'],
  cite: { doc: 'README.md', line: 3, quote: '`a` | add a file' },
};

describe('pack:draft', () => {
  it('accepts a valid reply and lifts the citations out of the pack', () => {
    const draft = parseDraft(reply([add]));
    if (!('pack' in draft)) throw new Error(draft.problems.join('; '));
    expect(draft.pack.lessons[0].items[0]).not.toHaveProperty('cite');
    expect(draft.citations.get('add-file')?.line).toBe(3);
  });

  it('reports schema errors, missing citations and suggested items without a match list', () => {
    expect(parseDraft('not json')).toHaveProperty('problems');
    const bad = parseDraft(reply([{ ...add, keys: [] }]));
    expect('problems' in bad && bad.problems[0]).toContain('lessons.0.items.0.keys');
    const uncited = parseDraft(reply([{ ...add, cite: undefined }, { ...add, id: 'other', source: 'suggested' }]));
    expect('problems' in uncited && uncited.problems).toEqual([
      'item "add-file": missing "cite" with doc, line and quote',
      'item "other": a suggested item needs a "match" list',
    ]);
  });

  it('checks a citation against the documentation', () => {
    expect(citationHolds(add.cite, docs)).toBe(true);
    expect(citationHolds({ ...add.cite, line: 4 }, docs)).toBe(true); // within two lines
    expect(citationHolds({ ...add.cite, quote: '`x` | explode' }, docs)).toBe(false);
    expect(citationHolds({ ...add.cite, doc: 'doc/missing.txt' }, docs)).toBe(false);
  });

  it('writes YAML that is still a valid pack, with a citation comment above each item', () => {
    const invented = { ...add, id: 'explode', keys: ['x'], cite: { doc: 'README.md', line: 4, quote: '`x` | explode' } };
    const draft = parseDraft(reply([add, invented]));
    if (!('pack' in draft)) throw new Error(draft.problems.join('; '));
    const { yaml, unverified } = renderDraft(draft, 'o/plugin', docs, '2026-01-01');
    expect(unverified).toBe(1);
    expect(yaml).toMatch(/# README\.md:3: `a` \| add a file\n\s+- id: add-file/);
    expect(yaml).toMatch(/# UNVERIFIED.*\n\s+- id: explode/);
    expect(packSchema.safeParse(parse(yaml)).success).toBe(true);
  });
});
