import type { GoalItem } from '../packs/schema';
import { parseMarkedBuffer, type BufferState } from '../surfaces/vimBuffer';

export function goalStart(item: GoalItem): BufferState {
  return { ...parseMarkedBuffer(item.start), mode: 'normal' };
}

export function goalEnd(item: GoalItem): BufferState {
  return { ...parseMarkedBuffer(item.end), mode: item.endMode };
}

/**
 * How many keypresses a goal or query drill allows. Any route to the end state
 * passes, so without a limit `llllll` would pass a drill that teaches `w`.
 * The default leaves room for a different but reasonable route, or a typo.
 */
export function keyBudget(maxKeys: number | undefined, answerLengths: number[]): number {
  if (maxKeys) return maxKeys;
  const longest = Math.max(...answerLengths);
  return longest + Math.max(2, Math.floor(longest / 2));
}
