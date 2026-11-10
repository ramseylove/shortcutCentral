/**
 * Key notation. A key token is one keypress in Neovim notation: either a single
 * printable character (`G`, `$`) or a bracketed name (`<Esc>`, `<C-w>`, `<S-Tab>`).
 * Tokens are always stored in the canonical spelling produced here, so two
 * tokens are the same key exactly when the strings are equal.
 */
export type KeyToken = string;

/** Lower-cased name or alias -> canonical name. */
const NAMED_KEYS: Record<string, string> = {
  esc: 'Esc',
  escape: 'Esc',
  cr: 'CR',
  enter: 'CR',
  return: 'CR',
  tab: 'Tab',
  bs: 'BS',
  backspace: 'BS',
  space: 'Space',
  del: 'Del',
  delete: 'Del',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  insert: 'Insert',
  lt: 'lt',
  leader: 'leader',
  localleader: 'localleader',
};
for (let i = 1; i <= 12; i++) NAMED_KEYS[`f${i}`] = `F${i}`;

/** Names that stand for a printable character and are stored as that character. */
const CHAR_ALIASES: Record<string, string> = { bar: '|', bslash: '\\' };

const MODIFIER_ORDER = ['C', 'M', 'S', 'D'];

function buildToken(mods: Set<string>, key: string): KeyToken {
  const isChar = [...key].length === 1;
  let base = key;
  if (isChar) {
    const isLetter = /^[a-zA-Z]$/.test(key);
    if (mods.has('C') && isLetter) {
      // <C-W> and <C-w> are the same key; Shift is kept as an explicit modifier.
      base = key.toLowerCase();
    } else if (mods.has('S') && isLetter) {
      // Shift folds into the character: <S-a> is A, <M-S-a> is <M-A>.
      base = key.toUpperCase();
      mods.delete('S');
    } else if (mods.has('S') && key !== ' ') {
      // A shifted symbol already is the shifted character.
      mods.delete('S');
    }
    if (base === ' ') base = 'Space';
    else if (base === '<') base = 'lt';
    if (mods.size === 0 && base.length === 1) return base;
  }
  const prefix = MODIFIER_ORDER.filter((m) => mods.has(m))
    .map((m) => `${m}-`)
    .join('');
  return `<${prefix}${base}>`;
}

/** Parses the inside of `<...>`. Returns null when it is not a known key. */
function parseBracketed(inner: string): KeyToken | null {
  const match = /^((?:[CSMAD]-)*)(.+)$/i.exec(inner);
  if (!match) return null;
  const mods = new Set(
    match[1]
      .split('-')
      .filter(Boolean)
      .map((m) => (m.toUpperCase() === 'A' ? 'M' : m.toUpperCase())),
  );
  const rawKey = match[2];
  if ([...rawKey].length === 1) return buildToken(mods, rawKey);
  const lower = rawKey.toLowerCase();
  if (lower in CHAR_ALIASES) return buildToken(mods, CHAR_ALIASES[lower]);
  const named = NAMED_KEYS[lower];
  if (!named) return null;
  if (named === 'lt') return buildToken(mods, '<');
  if (named === 'Space') return buildToken(mods, ' ');
  return buildToken(mods, named);
}

/**
 * Splits a sequence such as `<leader>ff` or `:wq<CR>` into canonical tokens.
 * A `<` that does not open a known key name is taken as a literal `<`.
 */
export function parseKeys(sequence: string): KeyToken[] {
  const tokens: KeyToken[] = [];
  const chars = [...sequence];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    if (ch === '<') {
      const close = chars.indexOf('>', i + 2);
      if (close !== -1) {
        const token = parseBracketed(chars.slice(i + 1, close).join(''));
        if (token) {
          tokens.push(token);
          i = close + 1;
          continue;
        }
      }
    }
    tokens.push(buildToken(new Set(), ch));
    i++;
  }
  return tokens;
}

/** Replaces `<leader>`-style placeholder tokens with their configured keys. */
export function expandPlaceholders(
  tokens: KeyToken[],
  placeholders: Record<string, string>,
): KeyToken[] {
  return tokens.flatMap((token) => {
    const name = /^<(\w+)>$/.exec(token)?.[1];
    if (name && name in placeholders) return parseKeys(placeholders[name]);
    return [token];
  });
}

export function formatKeys(tokens: KeyToken[]): string {
  return tokens.join('');
}

const EVENT_NAMED_KEYS: Record<string, string> = {
  Escape: 'Esc',
  Enter: 'CR',
  Tab: 'Tab',
  Backspace: 'BS',
  Delete: 'Del',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
};
for (let i = 1; i <= 12; i++) EVENT_NAMED_KEYS[`F${i}`] = `F${i}`;

const MODIFIER_EVENT_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'AltGraph',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'Hyper',
  'Super',
  'OS',
]);

/** US-layout characters for physical keys: [unshifted, shifted]. */
const CODE_CHARS: Record<string, [string, string]> = {
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Backquote: ['`', '~'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Space: [' ', ' '],
};
const DIGIT_SHIFTED = ')!@#$%^&*(';

function charFromCode(code: string, shift: boolean): string | null {
  const letter = /^Key([A-Z])$/.exec(code)?.[1];
  if (letter) return shift ? letter : letter.toLowerCase();
  const digit = /^Digit(\d)$/.exec(code)?.[1];
  if (digit) return shift ? DIGIT_SHIFTED[Number(digit)] : digit;
  const pair = CODE_CHARS[code];
  return pair ? pair[shift ? 1 : 0] : null;
}

/** The parts of a KeyboardEvent the normaliser reads. */
export interface KeyEventLike {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  getModifierState?: (key: string) => boolean;
}

/**
 * Turns a keydown event into a key token, or null for an event that is not a
 * keypress on its own (a bare modifier, or a key with no known character).
 */
export function normalizeKeyEvent(event: KeyEventLike): KeyToken | null {
  if (MODIFIER_EVENT_KEYS.has(event.key)) return null;

  // AltGr reports as Ctrl+Alt on Windows but only selects a character.
  const altGr = event.getModifierState?.('AltGraph') ?? false;
  const mods = new Set<string>();
  if (event.ctrlKey && !altGr) mods.add('C');
  if (event.altKey && !altGr) mods.add('M');
  if (event.metaKey) mods.add('D');

  const named = EVENT_NAMED_KEYS[event.key];
  if (named) {
    if (event.shiftKey) mods.add('S');
    return buildToken(mods, named);
  }

  let ch: string | null = event.key;
  const isSingleChar = [...ch].length === 1;
  // Dead keys, and Option on macOS (which yields characters such as "≈"),
  // do not carry a usable character, so the physical key is used instead.
  const optionComposed = mods.has('M') && isSingleChar && ch.charCodeAt(0) > 126;
  if (!isSingleChar || optionComposed) ch = charFromCode(event.code, event.shiftKey);
  if (!ch) return null;

  if (event.shiftKey && (ch === ' ' || (mods.has('C') && /^[a-zA-Z]$/.test(ch)))) mods.add('S');
  return buildToken(mods, ch);
}
