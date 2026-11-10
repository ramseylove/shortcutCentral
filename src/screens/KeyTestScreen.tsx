import { useState } from 'react';
import {
  RESERVED_CHORDS,
  enterImmersive,
  exitImmersive,
  supportsKeyboardLock,
} from '../keys/keyboardLock';
import type { KeyToken } from '../keys/notation';
import { useImmersive } from '../keys/useImmersive';
import { useKeyCapture } from '../keys/useKeyCapture';

/** Chords worth checking in each browser: the reserved ones, then common Vim keys. */
const CHECKLIST: KeyToken[] = [
  ...RESERVED_CHORDS,
  '<Esc>',
  '<Tab>',
  '<S-Tab>',
  '<C-r>',
  '<C-o>',
  '<C-d>',
  '<C-u>',
  '<C-v>',
  '<C-[>',
  '<C-^>',
  '<M-x>',
];

interface LoggedKey {
  token: KeyToken;
  key: string;
  code: string;
  mods: string;
}

/**
 * Shows exactly what the key-capture layer receives, so the chords each browser
 * delivers (with and without Keyboard Lock) can be checked by hand.
 */
export function KeyTestScreen() {
  const immersive = useImmersive();
  const [log, setLog] = useState<LoggedKey[]>([]);
  const [seen, setSeen] = useState<ReadonlySet<KeyToken>>(new Set());

  useKeyCapture((token, event) => {
    const mods = [
      event.ctrlKey && 'Ctrl',
      event.altKey && 'Alt',
      event.shiftKey && 'Shift',
      event.metaKey && 'Meta',
    ]
      .filter(Boolean)
      .join('+');
    setLog((previous) => [{ token, key: event.key, code: event.code, mods }, ...previous].slice(0, 15));
    setSeen((previous) => new Set(previous).add(token));
  });

  return (
    <div className="screen">
      <h1>Key test</h1>
      <p className="lede">
        Press any key or chord to see how it is captured. Outside locked fullscreen the browser
        acts on some chords itself: Ctrl+W closes this tab on Windows and Linux.
      </p>

      <dl className="status-grid">
        <dt>Keyboard Lock API</dt>
        <dd>{supportsKeyboardLock() ? 'Available' : 'Not available in this browser'}</dd>
        <dt>Secure context</dt>
        <dd>{window.isSecureContext ? 'Yes' : 'No (Keyboard Lock needs HTTPS or localhost)'}</dd>
        <dt>Fullscreen</dt>
        <dd>{immersive.fullscreen ? 'On' : 'Off'}</dd>
        <dt>Keyboard locked</dt>
        <dd data-testid="lock-state">{immersive.locked ? 'Yes' : 'No'}</dd>
      </dl>

      {supportsKeyboardLock() &&
        (immersive.fullscreen ? (
          <button type="button" className="button" onClick={() => void exitImmersive()}>
            Leave fullscreen
          </button>
        ) : (
          <button type="button" className="button primary" onClick={() => void enterImmersive()}>
            Enter fullscreen and lock keyboard
          </button>
        ))}
      {immersive.locked && <p className="hint">Hold Esc to leave fullscreen.</p>}

      <h2>Chords received</h2>
      <ul className="chord-checklist">
        {CHECKLIST.map((chord) => (
          <li key={chord} className={seen.has(chord) ? 'seen' : ''} data-testid={`chord-${chord}`}>
            <kbd>{chord}</kbd>
          </li>
        ))}
      </ul>

      <h2>Last keys</h2>
      <table className="key-log">
        <thead>
          <tr>
            <th>Notation</th>
            <th>event.key</th>
            <th>event.code</th>
            <th>Modifiers</th>
          </tr>
        </thead>
        <tbody data-testid="key-log">
          {log.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                Nothing pressed yet.
              </td>
            </tr>
          )}
          {log.map((entry, i) => (
            <tr key={log.length - i}>
              <td>
                <kbd>{entry.token}</kbd>
              </td>
              <td>{entry.key === ' ' ? '" "' : entry.key}</td>
              <td>{entry.code}</td>
              <td>{entry.mods}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
