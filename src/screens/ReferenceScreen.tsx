import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Answer } from '../drills/Answer';
import { useEnabledPacks } from '../packs/enabled';
import { cardKey } from '../packs/registry';
import { db } from '../store/db';

/** A searchable cheat sheet of every shortcut in the enabled packs. */
export function ReferenceScreen() {
  const { appId = '' } = useParams();
  const packs = useEnabledPacks(appId);
  const [query, setQuery] = useState('');
  const accuracy = useLiveQuery(async () => {
    const stats = new Map<string, { correct: number; total: number }>();
    await db.attempts.each((attempt) => {
      const entry = stats.get(attempt.cardKey) ?? { correct: 0, total: 0 };
      entry.total++;
      if (attempt.correct) entry.correct++;
      stats.set(attempt.cardKey, entry);
    });
    return stats;
  }, []);

  const rows = useMemo(
    () =>
      (packs ?? []).flatMap((pack) =>
        pack.lessons.flatMap((lesson) =>
          lesson.items.map((item) => ({
            key: cardKey(pack, item),
            item,
            where: `${pack.name} › ${lesson.title}`,
            haystack: [item.prompt, item.action, pack.name, lesson.title, ...item.keys].join('\n').toLowerCase(),
            // Key sequences are case-sensitive: G and g are different shortcuts.
            keys: item.keys,
          })),
        ),
      ),
    [packs],
  );

  if (!packs) return null;
  const needle = query.trim();
  const visible = needle
    ? rows.filter(
        (row) => row.haystack.includes(needle.toLowerCase()) || row.keys.some((keys) => keys.includes(needle)),
      )
    : rows;

  return (
    <div className="screen wide">
      <h1>Reference</h1>
      <input
        type="search"
        className="search"
        placeholder="Search by description or keys"
        aria-label="Search shortcuts"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <table className="reference" data-testid="reference">
        <thead>
          <tr>
            <th>Keys</th>
            <th>Shortcut</th>
            <th>Lesson</th>
            <th>Source</th>
            <th className="num">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const stats = accuracy?.get(row.key);
            return (
              <tr key={row.key}>
                <td>
                  <Answer appId={appId} item={row.item} />
                </td>
                <td>{row.item.prompt}</td>
                <td className="muted">{row.where}</td>
                <td>
                  <span className={`source ${row.item.source}`}>{row.item.source}</span>
                </td>
                <td className="num">
                  {stats ? `${Math.round((stats.correct / stats.total) * 100)}% (${stats.correct}/${stats.total})` : '—'}
                </td>
              </tr>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                No shortcut matches “{needle}”.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
