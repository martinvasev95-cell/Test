export type HabitId = 'gym' | 'run' | 'fuel' | 'macros';

export interface Habit {
  id: HabitId;
  label: string;
  hint: string;
}

export type HabitStatus = 'done' | 'missed';

/** A single day's status per habit. A habit missing from this record hasn't
 *  been logged yet for that day — that's distinct from having been marked
 *  missed, and shows as a neutral (grey) bubble rather than red. */
export type DayEntry = Partial<Record<HabitId, HabitStatus>>;

/** All logged days, keyed by local date (YYYY-MM-DD). */
export type TrackerData = Record<string, DayEntry>;
