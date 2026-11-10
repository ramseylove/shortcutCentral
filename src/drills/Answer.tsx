import { acceptedSequences } from '../packs/registry';
import type { PackItem } from '../packs/schema';
import { KeySequence } from './KeyEcho';

/** An item's accepted key sequences, the canonical one first. */
export function Answer({ appId, item }: { appId: string; item: PackItem }) {
  return (
    <span className="answer">
      {acceptedSequences(appId, item).map((keys, i) => (
        <span key={i}>
          {i > 0 && <span className="answer-or"> or </span>}
          <KeySequence keys={keys} />
        </span>
      ))}
    </span>
  );
}
