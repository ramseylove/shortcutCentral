/** A read-only buffer view with a block cursor, used by mocks and goal targets. */
export function StaticBuffer({
  text,
  cursor,
  insert = false,
}: {
  text: string;
  cursor: number;
  insert?: boolean;
}) {
  let offset = 0;
  return (
    <div className="static-buffer">
      {text.split('\n').map((line, i) => {
        const start = offset;
        offset += line.length + 1;
        const col = cursor - start;
        const onLine = col >= 0 && col <= line.length;
        return (
          <div className="static-line" key={i}>
            <span className="static-gutter">{i + 1}</span>
            <span className="static-text">
              {onLine ? (
                <>
                  {line.slice(0, col)}
                  <span className={insert ? 'cursor-bar' : 'cursor-block'}>{line[col] ?? ' '}</span>
                  {line.slice(col + 1)}
                </>
              ) : (
                line || ' '
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
