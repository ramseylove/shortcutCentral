import { EditorView } from '@codemirror/view';
import { useLayoutEffect, useRef } from 'react';
import { createVimView } from './vimBuffer';

const theme = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--surface)', color: 'var(--text)', fontSize: '16px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-content': { fontFamily: 'var(--mono)', padding: '10px 0', caretColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--muted)', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 14px' },
    '.cm-fat-cursor': { background: 'var(--accent) !important', color: 'var(--bg) !important' },
    '&:not(.cm-focused) .cm-fat-cursor': { outline: '1px solid var(--accent)', background: 'none !important' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'var(--selection) !important' },
    '.cm-panels': { backgroundColor: 'var(--surface-2)', color: 'var(--text)' },
    '.cm-vim-panel': { fontFamily: 'var(--mono)', padding: '2px 14px' },
  },
  { dark: true },
);

/**
 * The mini text buffer: CodeMirror in Vim mode. It owns no drill logic; the
 * drill reads the buffer through the view passed to `onReady`.
 */
export function MiniBuffer({
  start,
  onReady,
}: {
  start: { text: string; cursor: number };
  onReady: (view: EditorView) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const ready = useRef(onReady);
  ready.current = onReady;

  useLayoutEffect(() => {
    if (!host.current) return undefined;
    const view = createVimView(host.current, start, [theme]);
    view.focus();
    ready.current(view);
    return () => view.destroy();
    // The buffer is created once per mount; a new attempt remounts the drill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="mini-buffer" ref={host} data-testid="mini-buffer" />;
}
