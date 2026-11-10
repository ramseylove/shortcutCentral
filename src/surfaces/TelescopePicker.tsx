import type { ReactNode } from 'react';
import type { MockProps } from './EditorMock';

const DEFAULT_RESULTS = [
  'src/app.tsx',
  'src/main.ts',
  'src/components/Button.tsx',
  'src/components/Modal.tsx',
  'src/hooks/useAuth.ts',
  'README.md',
];

const PREVIEW = [
  'import { Button } from "./components/Button";',
  '',
  'export function App() {',
  '  return <Button label="Save" />;',
  '}',
];

export interface PickerRow {
  path: string;
  selected?: boolean;
  /** Ticked with <Tab> for a multi-selection. */
  marked?: boolean;
  /** An entry a query drill wants left in the list. */
  target?: boolean;
}

/** The Telescope layout: results above a prompt, with a preview pane beside them. */
export function PickerFrame({
  title,
  rows,
  count,
  prompt,
  mode,
  preview,
}: {
  title: string;
  rows: PickerRow[];
  count: string;
  prompt: ReactNode;
  mode: 'insert' | 'normal';
  preview?: ReactNode;
}) {
  return (
    <div className="mock picker">
      <div className="picker-main">
        <div className="picker-panel picker-results">
          <div className="picker-title">Results</div>
          <ul>
            {rows.map((row) => (
              <li
                key={row.path}
                className={[row.selected && 'selected', row.target && 'target'].filter(Boolean).join(' ')}
              >
                <span className="picker-caret">{row.selected ? '>' : row.marked ? '+' : ' '}</span>
                {row.path}
              </li>
            ))}
            {rows.length === 0 && <li className="muted">No results</li>}
          </ul>
        </div>
        <div className="picker-panel picker-prompt">
          <div className="picker-title">{title}</div>
          <div className="picker-prompt-line">
            <span className="picker-chevron">&gt;</span>
            {prompt}
            <span className="picker-count">{count}</span>
          </div>
        </div>
      </div>
      {preview && (
        <div className="picker-panel picker-preview">
          <div className="picker-title">Preview</div>
          {preview}
        </div>
      )}
      <div className="picker-mode">
        <span className={`mode-chip ${mode}`}>{mode.toUpperCase()}</span> in the picker prompt
      </div>
    </div>
  );
}

/** A static Telescope picker. It does not react to keys. */
export function TelescopePickerMock({ surface }: MockProps) {
  const results = Array.isArray(surface.results) ? (surface.results as string[]) : DEFAULT_RESULTS;
  const selected = typeof surface.selected === 'string' ? surface.selected : results[0];
  const marked = Array.isArray(surface.marked) ? (surface.marked as string[]) : [];
  const mode = surface.mode === 'normal' ? 'normal' : 'insert';
  const typed = typeof surface.prompt === 'string' ? surface.prompt : '';
  return (
    <PickerFrame
      title={typeof surface.title === 'string' ? surface.title : 'Find Files'}
      rows={results.map((path) => ({ path, selected: path === selected, marked: marked.includes(path) }))}
      count={`${results.length} / ${results.length}`}
      mode={mode}
      prompt={
        <span className="picker-typed">
          {typed}
          <span className={mode === 'insert' ? 'cursor-bar' : 'cursor-block'}> </span>
        </span>
      }
      preview={
        <pre className="picker-code">
          {PREVIEW.map((line, i) => (
            <div key={i}>
              <span className="static-gutter">{i + 1}</span>
              {line}
            </div>
          ))}
        </pre>
      }
    />
  );
}
