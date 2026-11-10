import type { PackItem } from '../packs/schema';
import { GoalDrill } from './GoalDrill';
import { KeyMatchDrill } from './KeyMatchDrill';
import { QueryDrill } from './QueryDrill';
import type { DrillProps } from './types';

export function Drill(props: DrillProps<PackItem>) {
  const { item } = props;
  switch (item.type) {
    case 'keys':
      return <KeyMatchDrill {...props} item={item} />;
    case 'goal':
      return <GoalDrill {...props} item={item} />;
    case 'query':
      return <QueryDrill {...props} item={item} />;
  }
}
