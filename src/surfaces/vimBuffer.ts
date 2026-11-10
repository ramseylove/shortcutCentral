import { history } from '@codemirror/commands';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, lineNumbers } from '@codemirror/view';
import { Vim, getCM, vim } from '@replit/codemirror-vim';
import type { KeyToken } from '../keys/notation';
import { CURSOR_MARK } from '../packs/schema';

export type VimMode = 'normal' | 'insert' | 'visual';

export interface BufferState {
  text: string;
  /** Offset of the character the cursor is on. */
  cursor: number;
  mode: VimMode;
}

/** Splits a marked buffer such as `foo |bar` into its text and cursor offset. */
export function parseMarkedBuffer(marked: string): { text: string; cursor: number } {
  const trimmed = marked.replace(/\n$/, '');
  const cursor = trimmed.indexOf(CURSOR_MARK);
  if (cursor === -1) throw new Error('buffer has no cursor mark');
  return { text: trimmed.slice(0, cursor) + trimmed.slice(cursor + 1), cursor };
}

export function formatMarkedBuffer(state: Pick<BufferState, 'text' | 'cursor'>): string {
  return state.text.slice(0, state.cursor) + CURSOR_MARK + state.text.slice(state.cursor);
}

export function createVimView(
  parent: HTMLElement,
  start: { text: string; cursor: number },
  extensions: Extension[] = [],
): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: start.text,
      selection: { anchor: start.cursor },
      // vim() goes first so its key handling takes precedence.
      extensions: [vim(), history(), drawSelection(), lineNumbers(), ...extensions],
    }),
  });
}

export function readBufferState(view: EditorView): BufferState {
  const vimState = getCM(view)?.state.vim;
  const mode: VimMode = vimState?.insertMode ? 'insert' : vimState?.visualMode ? 'visual' : 'normal';
  return {
    text: view.state.doc.toString(),
    cursor: view.state.selection.main.head,
    mode,
  };
}

export function sameBufferState(a: BufferState, b: BufferState): boolean {
  return a.text === b.text && a.cursor === b.cursor && a.mode === b.mode;
}

/**
 * Feeds key tokens to the Vim engine without DOM keyboard events. Used by the
 * pack tests and by on-screen chord buttons. Printable keys in insert mode are
 * not handled by the engine, so they are inserted here as the browser would.
 */
export function feedKeys(view: EditorView, tokens: KeyToken[]): void {
  const cm = getCM(view);
  if (!cm) throw new Error('view has no Vim state');
  for (const token of tokens) {
    const key = token === '<lt>' ? '<' : token === '<Space>' ? ' ' : token;
    const insertMode = Boolean(cm.state.vim?.insertMode);
    if (insertMode && [...key].length === 1) {
      view.dispatch(view.state.replaceSelection(key), { userEvent: 'input.type' });
    } else if (insertMode && key === '<CR>') {
      view.dispatch(view.state.replaceSelection('\n'), { userEvent: 'input.type' });
    } else {
      Vim.handleKey(cm, key === ' ' ? '<Space>' : key, 'user');
    }
  }
}
