// Spaced repetition: a small SM-2 style scheduler with day granularity.
// Grades: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy.
import { addDays } from './util.js';

export const MASTERED_DAYS = 21;

export const newCard = (today) => ({ due: addDays(today, 1), ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: null });

export function nextInterval(card, grade) {
  if (grade === 1) return 0;
  if (card.reps === 0) return { 2: 1, 3: 3, 4: 5 }[grade];
  const base = Math.max(1, card.ivl);
  const factor = grade === 2 ? 1.2 : grade === 3 ? card.ease : card.ease * 1.3;
  return Math.max(base + (grade === 2 ? 0 : 1), Math.round(base * factor));
}

export function schedule(card, grade, today) {
  const c = { ...card };
  const ivl = nextInterval(card, grade);
  if (grade === 1) {
    c.lapses += 1;
    c.reps = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
  } else {
    c.reps += 1;
    if (grade === 2) c.ease = Math.max(1.3, c.ease - 0.15);
    if (grade === 4) c.ease = Math.min(3.2, c.ease + 0.15);
  }
  c.ivl = ivl;
  c.due = addDays(today, ivl);
  c.last = today;
  return c;
}

export const label = (days) => (days === 0 ? 'now' : days < 30 ? `${days}d` : days < 365 ? `${Math.round(days / 30)}mo` : `${(days / 365).toFixed(1)}y`);

export const isMastered = (card) => card && card.ivl >= MASTERED_DAYS;
