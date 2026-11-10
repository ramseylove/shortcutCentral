import type { EditorView } from '@codemirror/view';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyToken } from '../keys/notation';
import { useKeyCapture } from '../keys/useKeyCapture';
import { acceptedSequences } from '../packs/registry';
import type { GoalItem } from '../packs/schema';
import { MiniBuffer } from '../surfaces/MiniBuffer';
import { StaticBuffer } from '../surfaces/StaticBuffer';
import { readBufferState, sameBufferState, type VimMode } from '../surfaces/vimBuffer';
import { goalEnd, goalStart, keyBudget } from './goalCheck';
import { KeyEcho } from './KeyEcho';
import type { DrillProps } from './types';

/**
 * Passes when the buffer's text, cursor and mode equal the item's end state,
 * whatever keys were used, within the key budget.
 */
export function GoalDrill({ appId, item, frozen, onResult }: DrillProps<GoalItem>) {
  const start = useMemo(() => goalStart(item), [item]);
  const end = useMemo(() => goalEnd(item), [item]);
  const budget = useMemo(() => keyBudget(item, acceptedSequences(appId, item)), [appId, item]);

  const view = useRef<EditorView | null>(null);
  const keys = useRef<KeyToken[]>([]);
  const resolved = useRef(false);
  const startedAt = useRef(performance.now());
  const [typed, setTyped] = useState<KeyToken[]>([]);
  const [mode, setMode] = useState<VimMode>('normal');
  const [outcome, setOutcome] = useState<'ok' | 'bad' | undefined>();

  const evaluate = () => {
    if (resolved.current || !view.current) return;
    const state = readBufferState(view.current);
    setMode(state.mode);
    const reached = sameBufferState(state, end);
    if (!reached && keys.current.length < budget) return;
    resolved.current = true;
    setOutcome(reached ? 'ok' : 'bad');
    view.current.contentDOM.blur();
    onResult({
      correct: reached,
      durationMs: Math.round(performance.now() - startedAt.current),
      keys: keys.current,
    });
  };

  // The editor handles the key itself; this only counts it, then checks the
  // buffer once the editor has applied it.
  useKeyCapture(
    (token) => {
      if (resolved.current || !view.current?.hasFocus) return;
      keys.current = [...keys.current, token];
      setTyped(keys.current);
      setTimeout(evaluate, 0);
    },
    { enabled: !frozen, preventDefault: false },
  );

  useEffect(() => {
    if (frozen) view.current?.contentDOM.blur();
  }, [frozen]);

  return (
    <div className="drill drill-goal">
      <div className="goal-panes">
        <div className="goal-pane">
          <div className="pane-label">
            Buffer <span className={`mode-chip ${mode}`}>{mode.toUpperCase()}</span>
          </div>
          <div
            className={`buffer-frame ${frozen ? 'frozen' : ''}`}
            onMouseDown={(event) => {
              // Keep focus in the editor wherever the frame is clicked.
              if (!frozen && event.target === event.currentTarget) {
                event.preventDefault();
                view.current?.focus();
              }
            }}
          >
            <MiniBuffer
              start={start}
              onReady={(v) => {
                view.current = v;
              }}
            />
          </div>
        </div>
        <div className="goal-pane">
          <div className="pane-label">
            Target <span className={`mode-chip ${end.mode}`}>{end.mode.toUpperCase()}</span>
          </div>
          <div className="buffer-frame target">
            <StaticBuffer text={end.text} cursor={end.cursor} insert={end.mode === 'insert'} />
          </div>
        </div>
      </div>
      <div className="goal-footer">
        <KeyEcho keys={typed} tone={outcome} />
        <span className="key-budget" data-testid="key-budget">
          {typed.length} / {budget} keys
        </span>
      </div>
    </div>
  );
}
