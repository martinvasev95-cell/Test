import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { formatWeekRange } from './lib/calendar';
import { HABITS } from './lib/habits';
import { buildHighlight } from './lib/highlights';
import {
  buildWeeks,
  computeStreak,
  cycleStatus,
  groupByMonth,
  loadData,
  saveData,
  summarizeDays,
  toDateKey,
} from './lib/storage';
import type { DayEntry, HabitId, TrackerData } from './types';

const HABIT_IDS = HABITS.map((h) => h.id);

export default function App() {
  const [data, setData] = useState<TrackerData>({});
  const [loaded, setLoaded] = useState(false);

  // Load once on mount, then persist on every change after that — the guard
  // stops the initial empty state from clobbering what's already stored.
  useEffect(() => {
    setData(loadData());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveData(data);
  }, [data, loaded]);

  const today = useMemo(() => new Date(), []);
  const todayKeyStr = toDateKey(today);
  const todayEntry = data[todayKeyStr] ?? {};

  const doneCount = HABITS.filter((h) => todayEntry[h.id] === 'done').length;
  const streak = useMemo(() => computeStreak(data, HABIT_IDS), [data]);
  const highlight = useMemo(() => buildHighlight(data, HABITS, today), [data, today]);
  const monthGroups = useMemo(() => groupByMonth(buildWeeks(data, today)), [data, today]);

  function toggle(dateKey: string, habitId: HabitId) {
    setData((prev) => {
      const entry: DayEntry = { ...prev[dateKey] };
      const next = cycleStatus(entry[habitId]);
      if (next === undefined) delete entry[habitId];
      else entry[habitId] = next;
      return { ...prev, [dateKey]: entry };
    });
  }

  function handleReset() {
    if (!confirm('Clear every logged day? This cannot be undone.')) return;
    setData({});
  }

  return (
    <div className="app">
      <header className="app__header">
        <h1>Daily Check-In</h1>
        <p className="app__date">
          {today.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      <section className="today">
        <div className="today__bubbles">
          {HABITS.map((habit) => (
            <button
              key={habit.id}
              type="button"
              className={`bubble bubble--${todayEntry[habit.id] ?? 'unset'}`}
              onClick={() => toggle(todayKeyStr, habit.id)}
              title={habit.hint}
            >
              <span className="bubble__dot" aria-hidden="true" />
              <span className="bubble__label">{habit.label}</span>
            </button>
          ))}
        </div>

        <div className="highlight">
          <span className="highlight__icon" aria-hidden="true">
            {highlight.icon}
          </span>
          <span className="highlight__text">{highlight.text}</span>
        </div>

        <p className="today__summary">
          {doneCount} of {HABITS.length} done today
          {streak > 1 && <span className="today__streak"> · 🔥 {streak} day streak</span>}
        </p>
      </section>

      <section className="history">
        <div className="history__head">
          <h2>Log</h2>
          <div className="history__cols">
            {HABITS.map((habit) => (
              <span key={habit.id} className="history__abbr" title={habit.label}>
                {habit.label[0]}
              </span>
            ))}
          </div>
        </div>

        {monthGroups.map((month) => {
            const monthDays = month.weeks.flatMap((w) => w.days);
            const monthSummary = summarizeDays(monthDays, data, HABIT_IDS);
            return (
              <div key={month.key} className="month">
                <div className="month__head">
                  <h3>{month.label}</h3>
                  <span className="month__summary">
                    {monthSummary.fullDays}/{monthSummary.totalDays} full days · {monthSummary.pct}%
                  </span>
                </div>

                {month.weeks.map((week) => {
                    const weekSummary = summarizeDays(week.days, data, HABIT_IDS);
                    const isCurrentWeek = week.days.some((d) => toDateKey(d) === todayKeyStr);
                    const weekEnd = week.days[week.days.length - 1];
                    return (
                      <div key={toDateKey(week.monday)} className="week">
                        <div className="week__head">
                          <span className="week__range">
                            {isCurrentWeek ? 'This week' : formatWeekRange(week.monday, weekEnd)}
                          </span>
                          <span className="week__summary">
                            {weekSummary.fullDays}/{weekSummary.totalDays} full · {weekSummary.pct}%
                          </span>
                        </div>
                        <div className="week__rows">
                          {week.days.map((day) => {
                            const key = toDateKey(day);
                            const entry = data[key] ?? {};
                            const isToday = key === todayKeyStr;
                            return (
                              <div key={key} className={`history__row${isToday ? ' history__row--today' : ''}`}>
                                <span className="history__date">
                                  {isToday
                                    ? 'Today'
                                    : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                                </span>
                                <div className="history__dots">
                                  {HABITS.map((habit) => (
                                    <button
                                      key={habit.id}
                                      type="button"
                                      className={`dot dot--${entry[habit.id] ?? 'unset'}`}
                                      onClick={() => toggle(key, habit.id)}
                                      aria-label={`${habit.label}, ${day.toDateString()}`}
                                      title={habit.label}
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </section>

      <footer className="app__footer">
        <p className="app__legend">
          <span className="legend__item">
            <span className="legend__dot legend__dot--done" aria-hidden="true" />
            done
          </span>
          <span className="legend__item">
            <span className="legend__dot legend__dot--missed" aria-hidden="true" />
            missed
          </span>
          <span className="legend__item">
            <span className="legend__dot legend__dot--unset" aria-hidden="true" />
            not logged
          </span>
        </p>
        <button type="button" className="app__reset" onClick={handleReset}>
          Clear all data
        </button>
      </footer>
    </div>
  );
}
