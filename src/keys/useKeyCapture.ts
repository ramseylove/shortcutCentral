import { useEffect, useRef } from 'react';
import { normalizeKeyEvent, type KeyToken } from './notation';

interface KeyCaptureOptions {
  enabled?: boolean;
  /** Stop the browser acting on the key (scrolling, focus moves, quick find). */
  preventDefault?: boolean;
  /** Drop auto-repeat events from a held key. */
  ignoreRepeat?: boolean;
}

/** Keys left to the browser even while a drill is capturing. */
function isBrowserPassthrough(event: KeyboardEvent): boolean {
  return event.metaKey || event.key === 'F5' || event.key === 'F11' || event.key === 'F12';
}

/**
 * The single key-capture layer: listens for keydown on the window and reports
 * each keypress as a key token.
 */
export function useKeyCapture(
  onKey: (token: KeyToken, event: KeyboardEvent) => void,
  { enabled = true, preventDefault = true, ignoreRepeat = false }: KeyCaptureOptions = {},
): void {
  const handler = useRef(onKey);
  handler.current = onKey;

  useEffect(() => {
    if (!enabled) return undefined;
    const listener = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (isBrowserPassthrough(event)) return;
      const token = normalizeKeyEvent(event);
      if (!token) return;
      if (preventDefault) event.preventDefault();
      if (ignoreRepeat && event.repeat) return;
      handler.current(token, event);
    };
    window.addEventListener('keydown', listener, { capture: true });
    return () => window.removeEventListener('keydown', listener, { capture: true });
  }, [enabled, preventDefault, ignoreRepeat]);
}
