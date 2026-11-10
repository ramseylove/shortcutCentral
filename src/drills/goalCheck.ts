import type { KeyToken } from '../keys/notation';
import type { GoalItem } from '../packs/schema';
import { parseMarkedBuffer, type BufferState } from '../surfaces/vimBuffer';

export function goalStart(item: GoalItem): BufferState {
  return { ...parseMarkedBuffer(item.start), mode: 'normal' };
}

export function goalEnd(item: GoalItem): BufferState {
  return { ...parseMarkedBuffer(item.end), mode: item.endMode };
}

/**
 * How many keypresses a goal drill allows. Any sequence reaching the end state
 * passes, so without a limit `llllll` would pass a drill that teaches `w`.
 * The default leaves room for a different but reasonable route, or a typo.
 */
export function keyBudget(item: GoalItem, accepted: KeyToken[][]): number {
  if (item.maxKeys) return item.maxKeys;
  const longest = Math.max(...accepted.map((sequence) => sequence.length));
  return longest + Math.max(2, Math.floor(longest / 2));
}
