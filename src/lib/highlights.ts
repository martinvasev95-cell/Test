import { buildWeeks, summarizeDays, toDateKey } from './storage';
import type { Habit, HabitId, TrackerData } from '../types';

export interface Highlight {
  icon: string;
  text: string;
}

function joinWithAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/** Consecutive days, counting back from today, this one habit was marked
 *  done — same today-only-counts-once-logged rule as computeStreak, just
 *  for a single habit instead of requiring every habit. */
export function computeHabitStreak(data: TrackerData, habitId: HabitId, today: Date): number {
  let streak = 0;
  const cursor = new Date(today);
  if (data[toDateKey(cursor)]?.[habitId] !== 'done') {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (data[toDateKey(cursor)]?.[habitId] === 'done') {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** One positive, data-driven line for today's card: the strongest active
 *  per-habit streak (2+ days), or a gentler fallback when there isn't one yet. */
export function buildHighlight(data: TrackerData, habits: Habit[], today: Date): Highlight {
  const streaks = habits.map((h) => ({ label: h.label, streak: computeHabitStreak(data, h.id, today) }));
  const active = streaks.filter((s) => s.streak >= 2);
  if (active.length > 0) {
    const best = Math.max(...active.map((s) => s.streak));
    const names = active.filter((s) => s.streak === best).map((s) => s.label);
    return { icon: '🔥', text: `${best}-day streak in ${joinWithAnd(names)}` };
  }

  const habitIds = habits.map((h) => h.id);
  const [currentWeek] = buildWeeks(data, today);
  const weekSummary = currentWeek ? summarizeDays(currentWeek.days, data, habitIds) : undefined;
  if (weekSummary && weekSummary.fullDays > 0) {
    const noun = weekSummary.fullDays === 1 ? 'day' : 'days';
    return { icon: '💪', text: `${weekSummary.fullDays} full ${noun} logged this week` };
  }

  return { icon: '👋', text: 'Tap a bubble below to start a streak' };
}
