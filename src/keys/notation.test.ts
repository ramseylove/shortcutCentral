import { describe, expect, it } from 'vitest';
import { expandPlaceholders, normalizeKeyEvent, parseKeys, type KeyEventLike } from './notation';
import { matchSequence } from './sequence';

function ev(key: string, code = '', mods: Partial<KeyEventLike> = {}): KeyEventLike {
  return { key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods };
}

describe('parseKeys', () => {
  it('splits plain and bracketed keys', () => {
    expect(parseKeys(':wq<CR>')).toEqual([':', 'w', 'q', '<CR>']);
    expect(parseKeys('<leader>ff')).toEqual(['<leader>', 'f', 'f']);
    expect(parseKeys('<C-w>v')).toEqual(['<C-w>', 'v']);
  });

  it('canonicalises aliases, case and modifier order', () => {
    expect(parseKeys('<enter><Return><cr>')).toEqual(['<CR>', '<CR>', '<CR>']);
    expect(parseKeys('<c-W>')).toEqual(['<C-w>']);
    expect(parseKeys('<A-x><M-x>')).toEqual(['<M-x>', '<M-x>']);
    expect(parseKeys('<S-C-Tab>')).toEqual(['<C-S-Tab>']);
    expect(parseKeys('<S-a>')).toEqual(['A']);
    expect(parseKeys('<Bar><Bslash>')).toEqual(['|', '\\']);
  });

  it('handles spaces and literal angle brackets', () => {
    expect(parseKeys('a b')).toEqual(['a', '<Space>', 'b']);
    expect(parseKeys('<lt>')).toEqual(['<lt>']);
    expect(parseKeys('>>')).toEqual(['>', '>']);
    expect(parseKeys('<<')).toEqual(['<lt>', '<lt>']);
    expect(parseKeys('d<notakey>')).toEqual(['d', '<lt>', 'n', 'o', 't', 'a', 'k', 'e', 'y', '>']);
    expect(parseKeys('<C-->')).toEqual(['<C-->']);
  });
});

describe('expandPlaceholders', () => {
  it('substitutes the leader', () => {
    expect(expandPlaceholders(parseKeys('<leader>ff'), { leader: '<Space>' })).toEqual([
      '<Space>',
      'f',
      'f',
    ]);
    expect(expandPlaceholders(parseKeys('<leader>ff'), { leader: ',' })).toEqual([',', 'f', 'f']);
  });
});

describe('normalizeKeyEvent', () => {
  it('ignores bare modifiers', () => {
    expect(normalizeKeyEvent(ev('Shift', 'ShiftLeft', { shiftKey: true }))).toBeNull();
    expect(normalizeKeyEvent(ev('Control', 'ControlLeft', { ctrlKey: true }))).toBeNull();
  });

  it('folds Shift into printable characters', () => {
    expect(normalizeKeyEvent(ev('G', 'KeyG', { shiftKey: true }))).toBe('G');
    expect(normalizeKeyEvent(ev('$', 'Digit4', { shiftKey: true }))).toBe('$');
    expect(normalizeKeyEvent(ev('}', 'BracketRight', { shiftKey: true }))).toBe('}');
    expect(normalizeKeyEvent(ev('<', 'Comma', { shiftKey: true }))).toBe('<lt>');
  });

  it('names special keys', () => {
    expect(normalizeKeyEvent(ev('Escape', 'Escape'))).toBe('<Esc>');
    expect(normalizeKeyEvent(ev('Enter', 'Enter'))).toBe('<CR>');
    expect(normalizeKeyEvent(ev(' ', 'Space'))).toBe('<Space>');
    expect(normalizeKeyEvent(ev('Tab', 'Tab', { shiftKey: true }))).toBe('<S-Tab>');
    expect(normalizeKeyEvent(ev('ArrowUp', 'ArrowUp'))).toBe('<Up>');
  });

  it('builds modifier chords', () => {
    expect(normalizeKeyEvent(ev('w', 'KeyW', { ctrlKey: true }))).toBe('<C-w>');
    expect(normalizeKeyEvent(ev('W', 'KeyW', { ctrlKey: true, shiftKey: true }))).toBe('<C-S-w>');
    expect(normalizeKeyEvent(ev('x', 'KeyX', { altKey: true }))).toBe('<M-x>');
    expect(normalizeKeyEvent(ev(']', 'BracketRight', { ctrlKey: true }))).toBe('<C-]>');
    expect(normalizeKeyEvent(ev('^', 'Digit6', { ctrlKey: true, shiftKey: true }))).toBe('<C-^>');
  });

  it('falls back to the physical key for dead and Option-composed keys', () => {
    expect(normalizeKeyEvent(ev('Dead', 'Backquote'))).toBe('`');
    expect(normalizeKeyEvent(ev('≈', 'KeyX', { altKey: true }))).toBe('<M-x>');
  });

  it('treats AltGr as a character selector, not a chord', () => {
    const altGr = { ctrlKey: true, altKey: true, getModifierState: (k: string) => k === 'AltGraph' };
    expect(normalizeKeyEvent(ev('{', 'Digit7', altGr))).toBe('{');
  });

  it('produces the same tokens as the parser', () => {
    expect(normalizeKeyEvent(ev('r', 'KeyR', { ctrlKey: true }))).toBe(parseKeys('<C-r>')[0]);
    expect(normalizeKeyEvent(ev('Tab', 'Tab', { shiftKey: true }))).toBe(parseKeys('<S-Tab>')[0]);
  });
});

describe('matchSequence', () => {
  const accepted = [parseKeys('ZZ'), parseKeys(':wq<CR>')];
  it('reports prefix, match and fail', () => {
    expect(matchSequence([], accepted)).toBe('prefix');
    expect(matchSequence(['Z'], accepted)).toBe('prefix');
    expect(matchSequence(['Z', 'Z'], accepted)).toBe('match');
    expect(matchSequence([':', 'w', 'q'], accepted)).toBe('prefix');
    expect(matchSequence([':', 'w', 'q', '<CR>'], accepted)).toBe('match');
    expect(matchSequence(['Z', 'Q'], accepted)).toBe('fail');
    expect(matchSequence(['x'], accepted)).toBe('fail');
  });
});
