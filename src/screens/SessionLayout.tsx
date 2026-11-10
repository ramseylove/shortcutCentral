import type { ReactNode } from 'react';
import { Answer } from '../drills/Answer';
import { enterImmersive, supportsKeyboardLock } from '../keys/keyboardLock';
import { useImmersive } from '../keys/useImmersive';
import type { PackItem } from '../packs/schema';

/** The frame around a running lesson or review: title, progress and exit. */
export function SessionLayout({
  title,
  progress,
  onExit,
  children,
}: {
  title: string;
  progress: string;
  onExit: () => void;
  children: ReactNode;
}) {
  const immersive = useImmersive();
  return (
    <div className="lesson-screen">
      <header className="lesson-header">
        <span className="lesson-name">{title}</span>
        <span className="lesson-progress" data-testid="lesson-progress">
          {progress}
        </span>
        <span className="header-spacer" />
        {supportsKeyboardLock() && !immersive.locked && (
          <button type="button" className="button small" onClick={() => void enterImmersive()}>
            Enter fullscreen
          </button>
        )}
        <button type="button" className="button small" onClick={onExit}>
          Exit
        </button>
      </header>
      {children}
    </div>
  );
}

/** The end-of-session summary: counts, accuracy and the shortcuts missed. */
export function SessionSummary({
  appId,
  heading,
  subtitle,
  countLabel,
  count,
  correct,
  missed,
  children,
}: {
  appId: string;
  heading: string;
  subtitle?: string;
  countLabel: string;
  count: number;
  correct: number;
  missed: PackItem[];
  children: ReactNode;
}) {
  const accuracy = count ? Math.round((correct / count) * 100) : 100;
  return (
    <div className="lesson-screen">
      <div className="summary" data-testid="lesson-summary">
        <h1>{heading}</h1>
        {subtitle && <p className="summary-title">{subtitle}</p>}
        <dl className="summary-stats">
          <div>
            <dt>{countLabel}</dt>
            <dd>{count}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{accuracy}%</dd>
          </div>
          <div>
            <dt>Missed</dt>
            <dd>{missed.length}</dd>
          </div>
        </dl>
        {missed.length > 0 && (
          <ul className="missed-list">
            {missed.map((item) => (
              <li key={item.id}>
                <span>{item.prompt}</span>
                <Answer appId={appId} item={item} />
              </li>
            ))}
          </ul>
        )}
        <div className="summary-actions">{children}</div>
      </div>
    </div>
  );
}

export function SessionMessage({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <div className="lesson-screen">
      <div className="summary">
        <h1>{heading}</h1>
        <div className="summary-actions">{children}</div>
      </div>
    </div>
  );
}
