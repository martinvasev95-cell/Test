import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { HABITS } from './lib/habits';
import {
  computeStreak,
  cycleStatus,
  lastNDays,
  loadData,
  saveData,
  toDateKey,
} from './lib/storage';
import type { DayEntry, HabitId, TrackerData } from './types';

const HISTORY_DAYS = 14;
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
  const history = useMemo(() => lastNDays(HISTORY_DAYS), []);

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
        <p className="today__summary">
          {doneCount} of {HABITS.length} done today
          {streak > 1 && <span className="today__streak"> · 🔥 {streak} day streak</span>}
        </p>
      </section>

      <section className="history">
        <h2>Last {HISTORY_DAYS} days</h2>
        <div className="history__head">
          <span className="history__date" aria-hidden="true" />
          <div className="history__dots">
            {HABITS.map((habit) => (
              <span key={habit.id} className="history__abbr" title={habit.label}>
                {habit.label[0]}
              </span>
            ))}
          </div>
        </div>
        <div className="history__rows">
          {history.map((date) => {
            const key = toDateKey(date);
            const entry = data[key] ?? {};
            const isToday = key === todayKeyStr;
            return (
              <div
                key={key}
                className={`history__row${isToday ? ' history__row--today' : ''}`}
              >
                <span className="history__date">
                  {date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </span>
                <div className="history__dots">
                  {HABITS.map((habit) => (
                    <button
                      key={habit.id}
                      type="button"
                      className={`dot dot--${entry[habit.id] ?? 'unset'}`}
                      onClick={() => toggle(key, habit.id)}
                      aria-label={`${habit.label}, ${date.toDateString()}`}
                      title={habit.label}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
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
