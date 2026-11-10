import { acceptedSequences } from '../packs/registry';
import type { PackItem } from '../packs/schema';
import { KeySequence } from './KeyEcho';

/** An item's accepted key sequences, the canonical one first. */
export function Answer({ appId, item }: { appId: string; item: PackItem }) {
  if (item.type === 'query') {
    // A query is typed text, so it reads better whole than as separate keys.
    return (
      <span className="answer">
        {item.keys.map((query, i) => (
          <span key={i}>
            {i > 0 && <span className="answer-or"> or </span>}
            <kbd>{query}</kbd>
          </span>
        ))}
      </span>
    );
  }
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
