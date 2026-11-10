import type { KeyToken } from './notation';

export type SequenceState = 'match' | 'prefix' | 'fail';

/**
 * Compares what has been typed with the accepted sequences. `prefix` means the
 * keys so far can still lead to a correct answer; `fail` means they cannot.
 */
export function matchSequence(typed: KeyToken[], accepted: KeyToken[][]): SequenceState {
  let prefix = false;
  for (const sequence of accepted) {
    if (typed.length > sequence.length) continue;
    if (!typed.every((token, i) => token === sequence[i])) continue;
    if (typed.length === sequence.length) return 'match';
    prefix = true;
  }
  return prefix ? 'prefix' : 'fail';
}
