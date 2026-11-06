// Loads the idea library from /content and builds lookup maps.
// Content is plain JSON so it can be updated with Claude Code and redeployed.
import { rng, shuffle, hash } from './util.js';

export const C = {
  loaded: false,
  contentVersion: 0,
  topics: [],
  topicById: new Map(),
  focus: {},
  sources: new Map(),
  ideas: new Map(),
  journeys: new Map(),
  builtInIds: [],
};

const get = async (path) => {
  const res = await fetch(`content/${path}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
};

export async function loadContent() {
  const index = await get('index.json');
  const [packs, journeys] = await Promise.all([
    Promise.all(index.packs.map((p) => get(p.file))),
    get(index.journeys),
  ]);
  C.contentVersion = index.contentVersion;
  C.topics = index.topics;
  C.topicById = new Map(index.topics.map((t) => [t.id, t]));
  C.focus = index.focus || {};
  C.sources.clear();
  C.ideas.clear();
  C.journeys.clear();
  for (const pack of packs) {
    for (const s of pack.sources) {
      const added = s.added || pack.added;
      const src = { ...s, topic: pack.id, added, ideaIds: s.ideas.map((i) => i.id) };
      delete src.ideas;
      C.sources.set(s.id, src);
      for (const i of s.ideas) {
        C.ideas.set(i.id, { ...i, sourceId: s.id, topic: pack.id, focus: i.focus || s.focus, added: i.added || added });
      }
    }
  }
  for (const j of journeys.journeys) C.journeys.set(j.id, j);
  C.builtInIds = [...C.ideas.keys()];
  C.loaded = true;
  return C;
}

/** Merge the user's own ideas into the maps (call after loadContent and whenever they change). */
export function mergeUserIdeas(userIdeas = []) {
  for (const [id, i] of C.ideas) if (i.own) C.ideas.delete(id);
  for (const u of userIdeas) {
    C.ideas.set(u.id, {
      id: u.id, title: u.title, body: u.body, action: u.action || '', q: u.q || '', a: u.a || '',
      topic: u.topic, focus: null, sourceId: null, own: true,
      ownSource: u.sourceTitle || '', ownAuthor: u.author || '', added: u.createdAt?.slice(0, 10),
    });
  }
}

export const idea = (id) => C.ideas.get(id);
export const source = (id) => C.sources.get(id);

export function sourceLine(i) {
  if (!i) return '';
  if (i.own) {
    if (i.ownSource && i.ownAuthor) return `${i.ownSource}, by ${i.ownAuthor}`;
    return i.ownSource || i.ownAuthor || 'Your own idea';
  }
  const s = C.sources.get(i.sourceId);
  if (!s) return '';
  if (s.type === 'concept') return /^common/i.test(s.author) ? s.title : `${s.title}, from ${s.author}`;
  return `${s.title}, by ${s.author}`;
}

/**
 * Choose `n` ideas for a day. Deterministic for a given seed so a regenerated
 * list stays the same. Unread first, mixed across topics, never two from one
 * source back to back. Falls back to the least recently read once the library
 * is exhausted.
 */
export function choosePicks({ n, seed, topics, focusPrefs = [], read, exclude = [], newIds = [], journeyNext = null }) {
  const r = rng(seed);
  const ex = new Set(exclude);
  const fresh = new Set(newIds);
  const pool = C.builtInIds.map((id) => C.ideas.get(id)).filter((i) => topics.includes(i.topic) && !ex.has(i.id));
  const unread = pool.filter((i) => !read[i.id]);
  const picks = [];
  if (journeyNext && !ex.has(journeyNext)) picks.push(C.ideas.get(journeyNext));

  const score = (i) => r() + (focusPrefs.includes(i.focus) ? 0.6 : 0) + (fresh.has(i.id) ? 1.2 : 0);
  const byTopic = new Map(topics.map((t) => [t, []]));
  for (const i of unread) if (!picks.includes(i)) byTopic.get(i.topic)?.push(i);
  for (const [t, list] of byTopic) byTopic.set(t, list.map((i) => [score(i), i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]));

  const order = shuffle(topics, r);
  let guard = 0;
  while (picks.length < n && guard++ < 500) {
    let added = false;
    for (const t of order) {
      if (picks.length >= n) break;
      const list = byTopic.get(t);
      if (!list?.length) continue;
      const last = picks[picks.length - 1];
      let idx = list.findIndex((i) => !last || i.sourceId !== last.sourceId);
      if (idx < 0) idx = 0;
      picks.push(list.splice(idx, 1)[0]);
      added = true;
    }
    if (!added) break;
  }
  if (picks.length < n) {
    const old = pool
      .filter((i) => read[i.id] && !picks.includes(i))
      .sort((a, b) => (read[a.id].last || 0) - (read[b.id].last || 0) || hash(a.id) - hash(b.id));
    picks.push(...old.slice(0, n - picks.length));
  }
  return picks.map((i) => i.id);
}

export function search(q) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const results = [];
  for (const i of C.ideas.values()) {
    const s = i.sourceId ? C.sources.get(i.sourceId) : null;
    const hay = [i.title, i.body, i.action, s?.title, s?.author, i.ownSource, i.ownAuthor, C.focus[i.focus]]
      .join(' ')
      .toLowerCase();
    if (terms.every((t) => hay.includes(t))) {
      const inTitle = terms.filter((t) => i.title.toLowerCase().includes(t)).length;
      results.push([inTitle, i]);
    }
  }
  return results.sort((a, b) => b[0] - a[0]).map((x) => x[1]);
}

/** Wrong-but-plausible answers for a quiz question: other answers from the same topic. */
export function distractors(id, count = 3, r = Math.random) {
  const target = C.ideas.get(id);
  const same = [...C.ideas.values()].filter((i) => i.id !== id && i.a && i.topic === target.topic);
  const nearFocus = same.filter((i) => i.focus === target.focus);
  const pickFrom = shuffle(nearFocus, r).concat(shuffle(same, r));
  const out = [];
  for (const i of pickFrom) {
    if (out.length >= count) break;
    if (!out.includes(i.a) && i.a !== target.a) out.push(i.a);
  }
  return out;
}
