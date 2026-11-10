import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useKeyCapture } from '../keys/useKeyCapture';
import type { QueryItem } from '../packs/schema';
import { PickerFrame } from '../surfaces/TelescopePicker';
import { filterFiles } from './fzfMatch';
import { keyBudget } from './goalCheck';
import type { DrillProps } from './types';

/**
 * Passes when the typed query narrows the file list to exactly the item's
 * targets, within the key budget. The list filters live as the query is typed.
 */
export function QueryDrill({ item, frozen, onResult }: DrillProps<QueryItem>) {
  const budget = useMemo(() => keyBudget(item.maxKeys, item.keys.map((query) => query.length)), [item]);
  const targets = useMemo(() => new Set(item.targets), [item]);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef('');
  const keys = useRef<string[]>([]);
  const resolved = useRef(false);
  const startedAt = useRef(performance.now());
  const [query, setQuery] = useState('');
  const [keyCount, setKeyCount] = useState(0);
  const [outcome, setOutcome] = useState<'ok' | 'bad' | undefined>();

  useLayoutEffect(() => {
    input.current?.focus();
  }, []);

  const remaining = filterFiles(item.files, query);

  const evaluate = () => {
    if (resolved.current) return;
    const left = filterFiles(item.files, latest.current);
    const reached = left.length === targets.size && left.every((file) => targets.has(file));
    if (!reached && keys.current.length < budget) return;
    resolved.current = true;
    setOutcome(reached ? 'ok' : 'bad');
    input.current?.blur();
    onResult({
      correct: reached,
      durationMs: Math.round(performance.now() - startedAt.current),
      keys: keys.current,
    });
  };

  // The input handles the key itself; this counts it, then checks the list
  // once the input's value has changed.
  useKeyCapture(
    (token) => {
      if (resolved.current || document.activeElement !== input.current) return;
      keys.current = [...keys.current, token];
      setKeyCount(keys.current.length);
      setTimeout(evaluate, 0);
    },
    { enabled: !frozen, preventDefault: false },
  );

  const targetsLeft = remaining.filter((file) => targets.has(file)).length;

  return (
    <div className="drill drill-query" onMouseDown={() => setTimeout(() => !frozen && input.current?.focus(), 0)}>
      <PickerFrame
        title="Find Files"
        mode="insert"
        rows={remaining.map((path) => ({ path, target: targets.has(path) }))}
        count={`${remaining.length} / ${item.files.length}`}
        prompt={
          <input
            ref={input}
            className="picker-input"
            data-testid="query-input"
            aria-label="Search query"
            value={query}
            readOnly={frozen}
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            onChange={(event) => {
              latest.current = event.target.value;
              setQuery(event.target.value);
            }}
          />
        }
      />
      <div className="goal-footer">
        <span className={`query-status ${outcome ?? ''}`}>
          Narrow the list to the {targets.size} highlighted {targets.size === 1 ? 'file' : 'files'}:{' '}
          {targetsLeft} of them listed, {remaining.length - targetsLeft} others still showing.
        </span>
        <span className="key-budget" data-testid="key-budget">
          {keyCount} / {budget} keys
        </span>
      </div>
    </div>
  );
}
