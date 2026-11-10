import type { KeyToken } from './notation';

/**
 * Chords a normal browser tab acts on itself (close tab, new window, new tab,
 * switch tab, and in Firefox quit) and never delivers to the page. Fullscreen with the Keyboard Lock
 * API delivers them, in Chromium-based browsers only.
 */
export const RESERVED_CHORDS: KeyToken[] = [
  '<C-w>',
  '<C-n>',
  '<C-t>',
  '<C-q>',
  '<C-S-w>',
  '<C-S-n>',
  '<C-S-t>',
  '<C-Tab>',
  '<C-S-Tab>',
];

export function isReservedChord(token: KeyToken): boolean {
  return RESERVED_CHORDS.includes(token);
}

interface KeyboardLockApi {
  lock(keyCodes?: string[]): Promise<void>;
  unlock(): void;
}

function keyboardApi(): KeyboardLockApi | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const keyboard = (navigator as Navigator & { keyboard?: Partial<KeyboardLockApi> }).keyboard;
  return keyboard && typeof keyboard.lock === 'function' ? (keyboard as KeyboardLockApi) : undefined;
}

export function supportsKeyboardLock(): boolean {
  return keyboardApi() !== undefined;
}

export interface ImmersiveState {
  fullscreen: boolean;
  /** True when reserved chords are being delivered to the page. */
  locked: boolean;
}

let state: ImmersiveState = { fullscreen: false, locked: false };
const listeners = new Set<() => void>();

function setState(next: ImmersiveState): void {
  if (next.fullscreen === state.fullscreen && next.locked === state.locked) return;
  state = next;
  listeners.forEach((listener) => listener());
}

if (typeof document !== 'undefined') {
  // Leaving fullscreen (long-press Esc, F11) also releases the keyboard lock.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) setState({ fullscreen: false, locked: false });
  });
}

export function getImmersiveState(): ImmersiveState {
  return state;
}

export function subscribeImmersive(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Goes fullscreen and locks the keyboard. Must be called from a user gesture.
 *
 * Fullscreen is only requested where Keyboard Lock exists. Without the lock a
 * browser uses Esc to leave fullscreen, so every <Esc> in a drill would drop
 * out of it; those browsers stay windowed and use the on-screen chord buttons.
 */
export async function enterImmersive(
  element: Element = document.documentElement,
): Promise<ImmersiveState> {
  const keyboard = keyboardApi();
  if (!keyboard) return state;

  let fullscreen = document.fullscreenElement !== null;
  if (!fullscreen) {
    try {
      await element.requestFullscreen();
      fullscreen = true;
    } catch {
      fullscreen = false;
    }
  }
  let locked = false;
  if (fullscreen) {
    try {
      await keyboard.lock();
      locked = true;
    } catch {
      locked = false;
    }
  }
  setState({ fullscreen, locked });
  return state;
}

export async function exitImmersive(): Promise<void> {
  keyboardApi()?.unlock();
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen();
    } catch {
      // Already left fullscreen.
    }
  }
  setState({ fullscreen: false, locked: false });
}
