import type { MockProps } from './EditorMock';

type Sign = 'add' | 'change' | 'delete' | undefined;

const LINES: { text: string; sign?: Sign; hunk?: number }[] = [
  { text: 'export function total(items) {' },
  { text: '  let sum = 0;' },
  { text: '  let count = 0;', sign: 'add', hunk: 1 },
  { text: '  for (const item of items) {' },
  { text: '    sum += item.price * item.quantity;', sign: 'change', hunk: 2 },
  { text: '    count += item.quantity;', sign: 'add', hunk: 2 },
  { text: '  }' },
  { text: '  return { sum, count };', sign: 'change', hunk: 3 },
  { text: '}', sign: 'delete', hunk: 4 },
];

const SIGN_CHAR = { add: '┃', change: '┃', delete: '▁' } as const;

/**
 * A static buffer with gitsigns markers in the sign column. The hunk under the
 * cursor is highlighted. `surface.line` (1-based) places the cursor.
 */
export function GitsignsBufferMock({ surface }: MockProps) {
  const cursorLine = typeof surface.line === 'number' ? surface.line : 5;
  const activeHunk = LINES[cursorLine - 1]?.hunk;
  return (
    <div className="mock mock-editor gitsigns">
      <div className="static-buffer">
        {LINES.map((line, i) => {
          const isCursor = i + 1 === cursorLine;
          const indent = line.text.length - line.text.trimStart().length;
          return (
            <div
              key={i}
              className={`static-line ${line.hunk !== undefined && line.hunk === activeHunk ? 'hunk-active' : ''}`}
            >
              <span className={`sign ${line.sign ?? ''}`}>{line.sign ? SIGN_CHAR[line.sign] : ' '}</span>
              <span className="static-gutter">{i + 1}</span>
              <span className="static-text">
                {isCursor ? (
                  <>
                    {line.text.slice(0, indent)}
                    <span className="cursor-block">{line.text[indent] ?? ' '}</span>
                    {line.text.slice(indent + 1)}
                  </>
                ) : (
                  line.text
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="statusline">
        <span className="mode-chip normal">NORMAL</span>
        <span>src/total.js</span>
        <span className="git-summary">
          <span className="sign add">+2</span> <span className="sign change">~2</span>{' '}
          <span className="sign delete">-1</span>
        </span>
        <span className="statusline-right">{cursorLine}:1</span>
      </div>
    </div>
  );
}
