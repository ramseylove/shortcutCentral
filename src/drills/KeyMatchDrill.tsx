import { useMemo, useRef, useState } from 'react';
import { isReservedChord } from '../keys/keyboardLock';
import type { KeyToken } from '../keys/notation';
import { matchSequence } from '../keys/sequence';
import { useImmersive } from '../keys/useImmersive';
import { useKeyCapture } from '../keys/useKeyCapture';
import { acceptedSequences } from '../packs/registry';
import type { KeysItem } from '../packs/schema';
import { MOCKS } from '../surfaces/mocks';
import { KeyEcho } from './KeyEcho';
import type { DrillProps } from './types';

/** Passes when the typed keys equal one of the item's accepted sequences. */
export function KeyMatchDrill({ appId, item, frozen, onResult }: DrillProps<KeysItem>) {
  const accepted = useMemo(() => acceptedSequences(appId, item), [appId, item]);
  const [typed, setTyped] = useState<KeyToken[]>([]);
  const [outcome, setOutcome] = useState<'ok' | 'bad' | undefined>();
  const typedRef = useRef<KeyToken[]>([]);
  const startedAt = useRef(performance.now());
  const { locked } = useImmersive();

  const press = (token: KeyToken) => {
    if (frozen || outcome) return;
    const next = [...typedRef.current, token];
    typedRef.current = next;
    setTyped(next);
    const state = matchSequence(next, accepted);
    if (state === 'prefix') return;
    // The drill ends on a full match, or on the first key that cannot lead to one.
    setOutcome(state === 'match' ? 'ok' : 'bad');
    onResult({
      correct: state === 'match',
      durationMs: Math.round(performance.now() - startedAt.current),
      keys: next,
    });
  };

  useKeyCapture(press, { enabled: !frozen, ignoreRepeat: true });

  // Chords the browser keeps for itself unless the keyboard is locked.
  const reserved = locked ? [] : [...new Set(accepted.flat().filter(isReservedChord))];
  const Mock = item.surface ? MOCKS[item.surface.mock] : undefined;

  return (
    <div className="drill drill-keys">
      {Mock && item.surface && <Mock surface={item.surface} typed={typed} />}
      <KeyEcho keys={typed} tone={outcome} />
      {reserved.length > 0 && (
        <div className="reserved-notice">
          <p>
            Your browser keeps {reserved.join(', ')} for itself outside locked fullscreen, so it
            cannot be typed here. Use the button instead.
          </p>
          {reserved.map((chord) => (
            <button
              key={chord}
              type="button"
              className="chord-button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => press(chord)}
            >
              {chord}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
