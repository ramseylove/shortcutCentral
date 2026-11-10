import { useSyncExternalStore } from 'react';
import { getImmersiveState, subscribeImmersive, type ImmersiveState } from './keyboardLock';

/** Current fullscreen and Keyboard Lock state. */
export function useImmersive(): ImmersiveState {
  return useSyncExternalStore(subscribeImmersive, getImmersiveState);
}
