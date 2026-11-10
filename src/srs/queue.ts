import type { CardRecord } from '../store/db';
import { endOfDay } from './scheduler';

/**
 * The cards to review now: due today or earlier, not suspended, belonging to an
 * item that still exists in an enabled pack, most overdue first, up to the cap.
 */
export function buildQueue(
  cards: CardRecord[],
  now: number,
  cap: number,
  knownKeys: ReadonlySet<string>,
): CardRecord[] {
  const cutoff = endOfDay(now);
  return cards
    .filter((card) => !card.suspended && card.due < cutoff && knownKeys.has(card.key))
    .sort((a, b) => a.due - b.due || a.key.localeCompare(b.key))
    .slice(0, cap);
}

/** Every due card, ignoring the session cap. */
export function countDue(cards: CardRecord[], now: number, knownKeys: ReadonlySet<string>): number {
  return buildQueue(cards, now, Number.POSITIVE_INFINITY, knownKeys).length;
}
