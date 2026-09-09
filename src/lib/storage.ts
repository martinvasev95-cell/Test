import type { DayEntry, HabitId, HabitStatus, TrackerData } from '../types';

const STORAGE_KEY = 'daily-checkin:v1';

/** Local calendar date as YYYY-MM-DD — deliberately not UTC/ISO, so "today"
 *  matches the day you're actually looking at the app on. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function loadData(): TrackerData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackerData) : {};
  } catch {
    // Corrupt JSON or storage unavailable (e.g. private browsing) — start fresh
    // rather than crashing the app.
    return {};
  }
}

export function saveData(data: TrackerData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or unavailable — the in-memory state still reflects
    // this session's taps, just won't survive a reload.
  }
}

/** Tapping a bubble cycles it: not logged -> done -> missed -> not logged. */
export function cycleStatus(status: HabitStatus | undefined): HabitStatus | undefined {
  if (status === undefined) return 'done';
  if (status === 'done') return 'missed';
  return undefined;
}

export function isDayComplete(entry: DayEntry | undefined, habitIds: HabitId[]): boolean {
  if (!entry) return false;
  return habitIds.every((id) => entry[id] === 'done');
}

/** Consecutive days, counting back from today, with every habit marked done.
 *  Today only counts once it's fully checked off itself — otherwise the
 *  streak would drop to zero every morning before you've had a chance to
 *  log anything. */
export function computeStreak(data: TrackerData, habitIds: HabitId[]): number {
  let streak = 0;
  const cursor = new Date();
  if (!isDayComplete(data[toDateKey(cursor)], habitIds)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (isDayComplete(data[toDateKey(cursor)], habitIds)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** The last n days including today, most recent first. */
export function lastNDays(n: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date();
  for (let i = 0; i < n; i++) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}
