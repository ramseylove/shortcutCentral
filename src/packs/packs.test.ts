import { describe, expect, it } from 'vitest';
import { goalEnd, goalStart, keyBudget } from '../drills/goalCheck';
import { createVimView, feedKeys, formatMarkedBuffer, readBufferState } from '../surfaces/vimBuffer';
import { filterFiles } from '../drills/fzfMatch';
import { acceptedSequences, allPacks } from './registry';
import { validatePacks } from './schema';

describe('pack validation', () => {
  const base = {
    id: 'demo',
    app: 'neovim',
    name: 'Demo',
    version: 1,
    lessons: [
      {
        id: 'one',
        title: 'One',
        items: [{ id: 'a', action: 'demo.a', prompt: 'Do a', type: 'keys', keys: ['a'] }],
      },
    ],
  };

  it('accepts a minimal pack and applies defaults', () => {
    const [pack] = validatePacks([{ file: 'demo.yaml', data: base }]);
    expect(pack.requires).toEqual([]);
    expect(pack.lessons[0].items[0].source).toBe('default');
  });

  const withItems = (items: unknown[]) => ({
    ...base,
    lessons: [{ id: 'one', title: 'One', items }],
  });
  const item = base.lessons[0].items[0];

  it('rejects duplicate item ids', () => {
    expect(() =>
      validatePacks([{ file: 'bad.yaml', data: withItems([item, item]) }]),
    ).toThrowError(/duplicate item id "a"/);
  });

  it('rejects unknown mocks and buffers without a cursor', () => {
    const items = [
      { ...item, id: 'b', surface: { mock: 'nope' } },
      { ...item, id: 'c', type: 'goal', start: 'no cursor', end: 'a|b' },
    ];
    expect(() => validatePacks([{ file: 'bad.yaml', data: withItems(items) }])).toThrowError(
      /surface\.mock[\s\S]*cursor mark/,
    );
  });

  it('rejects an unknown required pack and a duplicate pack', () => {
    expect(() =>
      validatePacks([{ file: 'demo.yaml', data: { ...base, requires: ['missing'] } }]),
    ).toThrowError(/requires unknown pack "missing"/);
    expect(() =>
      validatePacks([
        { file: 'a.yaml', data: base },
        { file: 'b.yaml', data: base },
      ]),
    ).toThrowError(/already defined in a\.yaml/);
  });
});

// Every accepted answer of every goal item is run against the real Vim engine,
// so a pack can only teach commands that behave here as the item claims.
describe('goal items reach their end state', () => {
  for (const pack of allPacks) {
    for (const lesson of pack.lessons) {
      for (const item of lesson.items) {
        if (item.type !== 'goal') continue;
        const sequences = acceptedSequences(pack.app, item);
        sequences.forEach((sequence, index) => {
          it(`${pack.app}/${pack.id}/${item.id}: ${item.keys[index]}`, () => {
            const parent = document.createElement('div');
            document.body.append(parent);
            const view = createVimView(parent, goalStart(item));
            try {
              feedKeys(view, sequence);
              const actual = readBufferState(view);
              const expected = goalEnd(item);
              expect(formatMarkedBuffer(actual)).toBe(formatMarkedBuffer(expected));
              expect(actual.mode).toBe(expected.mode);
              expect(sequence.length).toBeLessThanOrEqual(
                keyBudget(item.maxKeys, sequences.map((keys) => keys.length)),
              );
            } finally {
              view.destroy();
              parent.remove();
            }
          });
        });
      }
    }
  }
});

// Every accepted query of every query item must leave exactly the targets.
describe('query items narrow the list to their targets', () => {
  for (const pack of allPacks) {
    for (const lesson of pack.lessons) {
      for (const item of lesson.items) {
        if (item.type !== 'query') continue;
        for (const query of item.keys) {
          it(`${pack.app}/${pack.id}/${item.id}: ${query}`, () => {
            expect(filterFiles(item.files, query).sort()).toEqual([...item.targets].sort());
          });
        }
        it(`${pack.app}/${pack.id}/${item.id}: needs its operators`, () => {
          // Dropping the operators must give a different list, or the item teaches nothing.
          const plain = item.keys[0].replace(/['^$!]/g, '');
          expect(filterFiles(item.files, plain).sort()).not.toEqual([...item.targets].sort());
        });
      }
    }
  }
});
