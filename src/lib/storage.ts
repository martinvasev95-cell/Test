import { addDays, formatMonthLabel, monthKey, startOfWeek } from './calendar';
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

export interface PeriodSummary {
  /** Habit marks (across all days and habits) logged as done. */
  doneMarks: number;
  missedMarks: number;
  /** Days where every habit was marked done. */
  fullDays: number;
  totalDays: number;
  /** doneMarks as a percentage of totalDays * habitIds.length. */
  pct: number;
}

export function summarizeDays(days: Date[], data: TrackerData, habitIds: HabitId[]): PeriodSummary {
  let doneMarks = 0;
  let missedMarks = 0;
  let fullDays = 0;
  for (const day of days) {
    const entry = data[toDateKey(day)];
    if (!entry) continue;
    let doneToday = 0;
    for (const id of habitIds) {
      if (entry[id] === 'done') {
        doneMarks++;
        doneToday++;
      } else if (entry[id] === 'missed') {
        missedMarks++;
      }
    }
    if (doneToday === habitIds.length) fullDays++;
  }
  const totalPossible = days.length * habitIds.length;
  return {
    doneMarks,
    missedMarks,
    fullDays,
    totalDays: days.length,
    pct: totalPossible ? Math.round((doneMarks / totalPossible) * 100) : 0,
  };
}

export interface WeekGroup {
  monday: Date;
  /** Monday through today (this week) or Sunday (past weeks) — never future dates. */
  days: Date[];
}

export interface MonthGroup {
  key: string;
  label: string;
  weeks: WeekGroup[];
}

// A brand-new tracker still shows a bit of calendar structure (MIN_WEEKS),
// and once there's history it keeps extending back through logged weeks up
// to a sane cap (MAX_WEEKS, ~3 months) rather than growing forever.
const MIN_WEEKS = 4;
const MAX_WEEKS = 12;

/** Weeks (Monday-start), most recent first, far enough back to cover any
 *  logged history — or MIN_WEEKS of empty calendar structure if there's none yet. */
export function buildWeeks(data: TrackerData, today: Date): WeekGroup[] {
  const weeks: WeekGroup[] = [];
  let monday = startOfWeek(today);
  const todayKeyStr = toDateKey(today);
  for (let i = 0; i < MAX_WEEKS; i++) {
    const days: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(monday, d);
      if (toDateKey(day) > todayKeyStr) break;
      days.push(day);
    }
    const hasData = days.some((day) => data[toDateKey(day)]);
    if (i >= MIN_WEEKS && !hasData) break;
    weeks.push({ monday, days });
    monday = addDays(monday, -7);
  }
  return weeks;
}

/** Buckets weeks under the month their Monday falls in — simple and
 *  predictable, at the cost of a week that spans a month boundary being
 *  counted wholly under its start month. Fine for a personal log. */
export function groupByMonth(weeks: WeekGroup[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const week of weeks) {
    const key = monthKey(week.monday);
    const current = groups[groups.length - 1];
    if (!current || current.key !== key) {
      groups.push({ key, label: formatMonthLabel(week.monday), weeks: [week] });
    } else {
      current.weeks.push(week);
    }
  }
  return groups;
}
