import type { KeyToken } from '../keys/notation';

/** The keys typed so far, in Neovim notation. */
export function KeyEcho({ keys, tone }: { keys: KeyToken[]; tone?: 'ok' | 'bad' }) {
  return (
    <div className={`key-echo ${tone ?? ''}`} aria-live="polite" data-testid="key-echo">
      {keys.length === 0 ? (
        <span className="key-echo-empty">Type the shortcut…</span>
      ) : (
        keys.map((key, i) => <kbd key={i}>{key}</kbd>)
      )}
    </div>
  );
}

export function KeySequence({ keys }: { keys: KeyToken[] }) {
  return (
    <span className="key-sequence">
      {keys.map((key, i) => (
        <kbd key={i}>{key}</kbd>
      ))}
    </span>
  );
}
