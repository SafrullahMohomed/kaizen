// All personal data lives here and is saved to this device only (localStorage).
import { dayKey, addDays, uid } from './util.js';
import { newCard, schedule, isMastered } from './srs.js';
import { C, choosePicks, mergeUserIdeas } from './content.js';

const KEY = 'kaizen.state.v1';
export const APP_VERSION = '1.0.0';

const fresh = () => ({
  v: 1,
  createdAt: Date.now(),
  profile: { onboarded: false, topics: ['leadership', 'learning', 'engineering'], focus: [], dailyGoal: 5, reviewMode: 'all' },
  settings: { theme: 'auto' },
  read: {},
  days: {},
  picks: { date: null, ids: [] },
  stashes: [{ id: 'saved', name: 'Saved', ideas: [], createdAt: Date.now() }],
  srs: {},
  actions: [],
  journal: [],
  journeys: {},
  activeJourney: null,
  userIdeas: [],
  badges: {},
  bestStreak: 0,
  reviewsTotal: 0,
  knownIds: [],
  newIds: [],
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw);
    const base = fresh();
    return { ...base, ...s, profile: { ...base.profile, ...s.profile }, settings: { ...base.settings, ...s.settings } };
  } catch {
    return fresh();
  }
}

export let state = load();
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
let saveTimer;
export function commit({ quiet = false } = {}) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 150);
  if (!quiet) listeners.forEach((fn) => fn());
}
export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save', e);
  }
}
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && persist());

export function replaceState(next) {
  const base = fresh();
  state = { ...base, ...next, profile: { ...base.profile, ...next.profile }, settings: { ...base.settings, ...next.settings } };
  persist();
}
export function resetAll() {
  state = fresh();
  persist();
}

/* ---------- Badges (quiet; shown after reading, never over it) ---------- */
export const BADGES = [
  ['first-idea', 'First idea', 'Read your first idea'],
  ['goal-1', 'Goal reached', 'Hit your daily goal'],
  ['streak-3', 'Three in a row', 'Hit your goal three days running'],
  ['streak-7', 'A full week', 'Seven-day streak'],
  ['streak-30', 'A month of growth', 'Thirty-day streak'],
  ['streak-100', 'Hundred days', 'One-hundred-day streak'],
  ['read-25', 'Twenty-five ideas', 'Read 25 ideas'],
  ['read-100', 'One hundred ideas', 'Read 100 ideas'],
  ['first-save', 'Collector', 'Save an idea'],
  ['first-stash', 'Curator', 'Create your own stash'],
  ['first-reflect', 'Reflective', 'Write a reflection'],
  ['actions-1', 'Doer', 'Complete an action'],
  ['actions-10', 'Habit of action', 'Complete ten actions'],
  ['review-1', 'First recall', 'Finish a review'],
  ['review-100', 'Memory builder', 'Do 100 reviews'],
  ['mastered-10', 'It stuck', 'Master ten ideas'],
  ['journey-done', 'Journey complete', 'Finish a journey'],
  ['own-idea', 'Author', 'Write your own idea'],
  ['early', 'Early riser', 'Read before 7 in the morning'],
  ['night', 'Night owl', 'Read after 10 at night'],
];
export const pendingBadges = [];
export function award(id) {
  if (state.badges[id]) return;
  state.badges[id] = Date.now();
  pendingBadges.push(id);
}

/* ---------- Days, goal and streak ---------- */
export const today = () => dayKey();
export const dayRec = (k = today()) => (state.days[k] ||= { ids: [], reviews: 0, met: false });
export const goal = () => state.profile.dailyGoal;
export const readToday = () => (state.days[today()]?.ids.length || 0);

export function streak() {
  let k = today();
  if (!state.days[k]?.met) k = addDays(k, -1);
  let n = 0;
  while (state.days[k]?.met) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

function checkStreakBadges() {
  const s = streak();
  if (s > state.bestStreak) state.bestStreak = s;
  if (s >= 3) award('streak-3');
  if (s >= 7) award('streak-7');
  if (s >= 30) award('streak-30');
  if (s >= 100) award('streak-100');
}

/* ---------- Reading ---------- */
export function markRead(id) {
  const k = today();
  const day = dayRec(k);
  if (day.ids.includes(id)) return false;
  day.ids.push(id);
  const t = Date.now();
  const prev = state.read[id];
  state.read[id] = prev ? { ...prev, last: t, n: (prev.n || 1) + 1 } : { first: t, last: t, n: 1 };
  if (!prev && state.profile.reviewMode === 'all') addToReview(id);
  state.newIds = state.newIds.filter((x) => x !== id);
  award('first-idea');
  const total = Object.keys(state.read).length;
  if (total >= 25) award('read-25');
  if (total >= 100) award('read-100');
  const h = new Date().getHours();
  if (h < 7 && h >= 3) award('early');
  if (h >= 22) award('night');
  if (!day.met && day.ids.length >= goal()) {
    day.met = true;
    day.goal = goal();
    award('goal-1');
    checkStreakBadges();
  }
  checkJourneys(id);
  commit({ quiet: true });
  return true;
}

export const isRead = (id) => !!state.read[id];

/* ---------- Today's picks ---------- */
export function journeyNext(jid = state.activeJourney) {
  const j = jid && C.journeys.get(jid);
  if (!j) return null;
  return j.ideas.find((id) => !state.read[id]) || null;
}

export function ensurePicks() {
  const k = today();
  if (state.picks.date === k && state.picks.ids.length) {
    state.picks.ids = state.picks.ids.filter((id) => C.ideas.has(id));
    return state.picks.ids;
  }
  state.picks = {
    date: k,
    ids: choosePicks({
      n: goal(),
      seed: k,
      topics: state.profile.topics,
      focusPrefs: state.profile.focus,
      read: state.read,
      newIds: state.newIds,
      journeyNext: journeyNext(),
    }),
  };
  commit({ quiet: true });
  return state.picks.ids;
}

export function morePicks(n = goal()) {
  const ids = choosePicks({
    n,
    seed: today() + ':' + state.picks.ids.length,
    topics: state.profile.topics,
    focusPrefs: state.profile.focus,
    read: state.read,
    exclude: state.picks.ids,
    newIds: state.newIds,
    journeyNext: (() => { const j = journeyNext(); return j && !state.picks.ids.includes(j) ? j : null; })(),
  });
  state.picks.ids.push(...ids);
  commit({ quiet: true });
  return ids;
}

/** Rebuild today's list after settings change, keeping ideas already read today. */
export function refreshPicks() {
  const k = today();
  const readNow = dayRec(k).ids;
  const keep = state.picks.date === k ? state.picks.ids.filter((id) => readNow.includes(id)) : [];
  const add = choosePicks({
    n: Math.max(0, goal() - keep.length),
    seed: k + ':r' + keep.length,
    topics: state.profile.topics,
    focusPrefs: state.profile.focus,
    read: state.read,
    exclude: keep,
    newIds: state.newIds,
    journeyNext: journeyNext(),
  });
  state.picks = { date: k, ids: [...keep, ...add] };
  commit();
}

export function setGoal(n) {
  state.profile.dailyGoal = n;
  const day = dayRec();
  if (!day.met && day.ids.length >= n) {
    day.met = true;
    day.goal = n;
    checkStreakBadges();
  }
  refreshPicks();
}

export function setAreas(topics, focus) {
  state.profile.topics = topics;
  state.profile.focus = focus;
  refreshPicks();
}

/* ---------- Stashes ---------- */
export const savedStash = () => state.stashes.find((s) => s.id === 'saved');
export const isSaved = (id) => state.stashes.some((s) => s.ideas.includes(id));
export const stashesFor = (id) => state.stashes.filter((s) => s.ideas.includes(id)).map((s) => s.id);

export function setInStash(stashId, ideaId, on) {
  const s = state.stashes.find((x) => x.id === stashId);
  if (!s) return;
  const has = s.ideas.includes(ideaId);
  if (on && !has) s.ideas.unshift(ideaId);
  if (!on && has) s.ideas = s.ideas.filter((x) => x !== ideaId);
  if (on) {
    award('first-save');
    if (state.profile.reviewMode === 'saved') addToReview(ideaId);
  }
  commit();
}

export function createStash(name) {
  const s = { id: uid('s-'), name: name.trim() || 'Untitled', ideas: [], createdAt: Date.now() };
  state.stashes.push(s);
  award('first-stash');
  commit();
  return s;
}
export function renameStash(id, name) {
  const s = state.stashes.find((x) => x.id === id);
  if (s && name.trim()) s.name = name.trim();
  commit();
}
export function deleteStash(id) {
  if (id === 'saved') return;
  state.stashes = state.stashes.filter((x) => x.id !== id);
  commit();
}

/* ---------- Review (spaced repetition) ---------- */
export function addToReview(id) {
  if (!state.srs[id]) state.srs[id] = newCard(today());
}
export const inReview = (id) => !!state.srs[id];
export function removeFromReview(id) {
  delete state.srs[id];
  commit();
}
export function dueIds(k = today()) {
  return Object.entries(state.srs)
    .filter(([id, c]) => c.due <= k && C.ideas.has(id))
    .sort((a, b) => (a[1].due < b[1].due ? -1 : 1))
    .map(([id]) => id);
}
export function grade(id, g) {
  const c = state.srs[id] || newCard(today());
  state.srs[id] = schedule(c, g, today());
  dayRec().reviews += 1;
  state.reviewsTotal += 1;
  award('review-1');
  if (state.reviewsTotal >= 100) award('review-100');
  if (masteredCount() >= 10) award('mastered-10');
  commit({ quiet: true });
}
export const masteredCount = () => Object.values(state.srs).filter(isMastered).length;
export function nextDueSummary() {
  const k = today();
  const future = Object.values(state.srs).map((c) => c.due).filter((d) => d > k).sort();
  return future[0] || null;
}

/* ---------- Actions and journal ---------- */
export const openActions = () => state.actions.filter((a) => !a.done);
export function addAction(ideaId, text) {
  const existing = state.actions.find((a) => a.ideaId === ideaId && !a.done);
  if (existing) return existing;
  const a = { id: uid('a-'), ideaId, text, added: today(), done: false };
  state.actions.unshift(a);
  commit();
  return a;
}
export function completeAction(id, note = '') {
  const a = state.actions.find((x) => x.id === id);
  if (!a) return;
  a.done = true;
  a.doneAt = Date.now();
  if (note.trim()) addJournal({ ideaId: a.ideaId, text: note.trim(), kind: 'action', action: a.text });
  const n = state.actions.filter((x) => x.done).length;
  award('actions-1');
  if (n >= 10) award('actions-10');
  commit();
}
export function removeAction(id) {
  state.actions = state.actions.filter((x) => x.id !== id);
  commit();
}
export function addJournal({ ideaId = null, text, kind = 'reflection', action = null }) {
  state.journal.unshift({ id: uid('j-'), ideaId, text, kind, action, at: Date.now() });
  if (kind === 'reflection') award('first-reflect');
  commit();
}
export function deleteJournal(id) {
  state.journal = state.journal.filter((x) => x.id !== id);
  commit();
}

/* ---------- Journeys ---------- */
export function startJourney(id) {
  state.journeys[id] ||= { started: Date.now() };
  state.activeJourney = id;
  commit();
}
export function stopJourney() {
  state.activeJourney = null;
  commit();
}
export function journeyProgress(id) {
  const j = C.journeys.get(id);
  if (!j) return { done: 0, total: 0 };
  return { done: j.ideas.filter((x) => state.read[x]).length, total: j.ideas.length };
}
function checkJourneys(readId) {
  for (const [id, j] of C.journeys) {
    if (!j.ideas.includes(readId)) continue;
    const p = journeyProgress(id);
    if (p.done === p.total && state.journeys[id] && !state.journeys[id].done) {
      state.journeys[id].done = Date.now();
      award('journey-done');
      if (state.activeJourney === id) state.activeJourney = null;
    }
  }
}

/* ---------- User's own ideas ---------- */
export function saveUserIdea(data) {
  if (data.id) {
    const i = state.userIdeas.findIndex((u) => u.id === data.id);
    if (i >= 0) state.userIdeas[i] = { ...state.userIdeas[i], ...data };
  } else {
    data = { ...data, id: uid('u-'), createdAt: new Date().toISOString() };
    state.userIdeas.unshift(data);
    award('own-idea');
  }
  mergeUserIdeas(state.userIdeas);
  commit();
  return data;
}
export function deleteUserIdea(id) {
  state.userIdeas = state.userIdeas.filter((u) => u.id !== id);
  for (const s of state.stashes) s.ideas = s.ideas.filter((x) => x !== id);
  delete state.srs[id];
  mergeUserIdeas(state.userIdeas);
  commit();
}

/* ---------- New content detection ---------- */
export function syncKnownIds() {
  const ids = C.builtInIds;
  if (!state.knownIds.length) {
    state.knownIds = ids.slice();
    commit({ quiet: true });
    return [];
  }
  const known = new Set(state.knownIds);
  const added = ids.filter((id) => !known.has(id));
  if (added.length) {
    state.newIds = [...new Set([...state.newIds, ...added])];
    state.knownIds = ids.slice();
    commit({ quiet: true });
  }
  return added;
}
export const isNew = (id) => state.newIds.includes(id) && !state.read[id];

/* ---------- Stats ---------- */
export function stats() {
  return {
    streak: streak(),
    best: Math.max(state.bestStreak, streak()),
    read: Object.keys(state.read).length,
    mastered: masteredCount(),
    inReview: Object.keys(state.srs).length,
    reviews: state.reviewsTotal,
    actionsDone: state.actions.filter((a) => a.done).length,
    reflections: state.journal.length,
    saved: new Set(state.stashes.flatMap((s) => s.ideas)).size,
  };
}
