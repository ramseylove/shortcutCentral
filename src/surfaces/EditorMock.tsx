import type { KeyToken } from '../keys/notation';
import { StaticBuffer } from './StaticBuffer';

const SAMPLE = [
  'export function total(items) {',
  '  let sum = 0;',
  '  for (const item of items) {',
  '    sum += item.price * item.quantity;',
  '  }',
  '  return sum;',
  '}',
].join('\n');

export interface MockProps {
  /** The pack item's `surface` block. */
  surface: Record<string, unknown>;
  /** Keys typed so far in the current drill. */
  typed: KeyToken[];
}

/** A plain, static buffer view. It does not react to keys, except to echo a `:` command. */
export function EditorMock({ surface, typed }: MockProps) {
  const insert = surface.mode === 'insert';
  const modified = surface.modified === true;
  const command = typed[0] === ':' ? typed.filter((key) => [...key].length === 1).join('') : '';
  return (
    <div className="mock mock-editor">
      <StaticBuffer text={SAMPLE} cursor={SAMPLE.indexOf('sum += ')} insert={insert} />
      <div className="statusline">
        <span className={`mode-chip ${insert ? 'insert' : 'normal'}`}>{insert ? 'INSERT' : 'NORMAL'}</span>
        <span>src/total.js{modified ? ' [+]' : ''}</span>
        <span className="statusline-right">4:5</span>
      </div>
      <div className="cmdline">{command || (insert ? '-- INSERT --' : ' ')}</div>
    </div>
  );
}
