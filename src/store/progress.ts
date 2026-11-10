import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Lesson completion, kept in localStorage for now so unlocks survive a reload.
 * Milestone 3 replaces this with the Dexie tables from the spec.
 */
interface ProgressState {
  /** Lesson keys (`app/pack/lesson`) -> completion time in ms. */
  completedLessons: Record<string, number>;
  completeLesson: (key: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completedLessons: {},
      completeLesson: (key) =>
        set((state) =>
          key in state.completedLessons
            ? state
            : { completedLessons: { ...state.completedLessons, [key]: Date.now() } },
        ),
      reset: () => set({ completedLessons: {} }),
    }),
    { name: 'shortcut-central-progress', version: 1 },
  ),
);
