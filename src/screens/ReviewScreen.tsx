import { useEffect, useReducer, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DrillStage } from '../drills/DrillStage';
import { exitImmersive } from '../keys/keyboardLock';
import { indexItems, loadEnabledPacks } from '../packs/enabled';
import type { Pack, PackItem } from '../packs/schema';
import { buildQueue } from '../srs/queue';
import { medianDurations, type Medians } from '../srs/rating';
import { isFirstAnswer, reviewReducer, startReview } from '../srs/reviewSession';
import { db } from '../store/db';
import { applyReview, recordAttempt } from '../store/progress';
import { DEFAULT_SESSION_CAP, getSetting, settingNames } from '../store/settings';
import { SessionLayout, SessionMessage, SessionSummary } from './SessionLayout';

interface ReviewPlan {
  keys: string[];
  items: Map<string, { pack: Pack; item: PackItem }>;
  medians: Medians;
}

/** Reads the due cards once, at the start: the queue does not change mid-session. */
async function planReview(appId: string): Promise<ReviewPlan> {
  const [packs, cards, attempts, cap] = await Promise.all([
    loadEnabledPacks(appId),
    db.cards.where('app').equals(appId).toArray(),
    db.attempts.toArray(),
    getSetting(settingNames.sessionCap, DEFAULT_SESSION_CAP),
  ]);
  const items = indexItems(packs);
  const queue = buildQueue(cards, Date.now(), cap, new Set(items.keys()));
  return { keys: queue.map((card) => card.key), items, medians: medianDurations(attempts) };
}

function ReviewRunner({ appId, plan }: { appId: string; plan: ReviewPlan }) {
  const navigate = useNavigate();
  const [session, dispatch] = useReducer(reviewReducer, plan.keys, startReview);
  const leave = () => {
    void exitImmersive();
    navigate(`/${appId}/today`);
  };

  if (session.done) {
    return (
      <SessionSummary
        appId={appId}
        heading="Reviews done"
        countLabel="Cards reviewed"
        count={session.total}
        correct={session.total - session.missed.length}
        missed={session.missed.map((key) => plan.items.get(key)!.item)}
      >
        <button type="button" className="button primary" onClick={leave}>
          Back to Today
        </button>
      </SessionSummary>
    );
  }

  const current = plan.items.get(session.queue[0])!;
  const remaining = new Set(session.queue).size;
  return (
    <SessionLayout
      title="Review"
      progress={`${session.total - remaining} of ${session.total} done`}
      onExit={leave}
    >
      <DrillStage
        appId={appId}
        item={current.item}
        attempt={session.attempt}
        phase="review"
        result={session.result}
        answerVisible={false}
        onAnswer={(result) => {
          // Only a card's first answer in the session sets its rating.
          if (isFirstAnswer(session)) {
            void applyReview(current.pack, current.item, result, plan.medians);
          }
          void recordAttempt(current.pack, current.item, result, 'review');
          dispatch({ type: 'answer', result });
        }}
        onNext={() => dispatch({ type: 'next' })}
      />
    </SessionLayout>
  );
}

export function ReviewScreen() {
  const { appId = '' } = useParams();
  const [plan, setPlan] = useState<ReviewPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    void planReview(appId).then((next) => {
      if (!cancelled) setPlan(next);
    });
    return () => {
      cancelled = true;
    };
  }, [appId]);

  if (!plan) return <div className="lesson-screen" />;
  if (plan.keys.length === 0) {
    return (
      <SessionMessage heading="Nothing is due for review">
        <Link className="button" to={`/${appId}/today`}>
          Back to Today
        </Link>
      </SessionMessage>
    );
  }
  return <ReviewRunner appId={appId} plan={plan} />;
}
