import type { MockProps } from './EditorMock';

const NODES: { depth: number; name: string; dir?: 'open' | 'closed'; git?: 'M' | '?' }[] = [
  { depth: 0, name: '~/projects/shop', dir: 'open' },
  { depth: 1, name: 'src', dir: 'open' },
  { depth: 2, name: 'components', dir: 'closed' },
  { depth: 2, name: 'cart.ts', git: 'M' },
  { depth: 2, name: 'utils', dir: 'closed' },
  { depth: 2, name: 'total.ts' },
  { depth: 1, name: 'tests', dir: 'closed' },
  { depth: 1, name: 'package.json' },
  { depth: 1, name: 'README.md', git: '?' },
];

const BUFFER = ['export function total(items) {', '  let sum = 0;', '  for (const item of items) {', '    sum += item.price;', '  }', '  return sum;', '}'];

/**
 * A static Neo-tree file tree beside a buffer, with focus in the tree.
 * `surface.line` (1-based) places the cursor on a node.
 */
export function NeoTreePanelMock({ surface }: MockProps) {
  const cursorLine = typeof surface.line === 'number' ? surface.line : 4;
  return (
    <div className="mock mock-editor neo-tree">
      <div className="neo-tree-split">
        <div className="neo-tree-panel" data-testid="neo-tree-panel">
          {NODES.map((node, i) => (
            <div key={i} className={`neo-tree-node ${i + 1 === cursorLine ? 'cursor-line' : ''}`}>
              <span>{'  '.repeat(node.depth)}</span>
              <span className="neo-tree-icon">{node.dir === 'open' ? '▾ ' : node.dir === 'closed' ? '▸ ' : '  '}</span>
              <span className={node.dir ? 'neo-tree-dir' : ''}>{node.name}</span>
              {node.git && <span className={`neo-tree-git ${node.git === 'M' ? 'modified' : 'untracked'}`}> {node.git}</span>}
            </div>
          ))}
        </div>
        <div className="static-buffer neo-tree-buffer">
          {BUFFER.map((text, i) => (
            <div key={i} className="static-line">
              <span className="static-gutter">{i + 1}</span>
              <span className="static-text">{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="statusline">
        <span className="mode-chip normal">NORMAL</span>
        <span>neo-tree filesystem</span>
        <span className="statusline-right">{cursorLine}:1</span>
      </div>
    </div>
  );
}
