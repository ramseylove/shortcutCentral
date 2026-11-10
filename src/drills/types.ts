import type { AttemptResult } from '../curriculum/lessonSession';

export interface DrillProps<Item> {
  appId: string;
  item: Item;
  /** Set once the attempt has a result; the drill stops taking input. */
  frozen: boolean;
  onResult: (result: AttemptResult) => void;
}
