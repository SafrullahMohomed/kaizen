// Small shared helpers: escaping, dates, seeded randomness.

export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Turn plain text with blank-line paragraphs into <p> tags. */
export const paras = (s = '') =>
  String(s).split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDay = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k, n) => {
  const d = parseDay(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

export const diffDays = (a, b) => {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
};

export const fmtDay = (k, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  parseDay(k).toLocaleDateString(undefined, opts);

export const relDay = (k) => {
  const t = dayKey();
  const d = diffDays(k, t); // positive = past, negative = future
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d === -1) return 'Tomorrow';
  if (Math.abs(d) < 7) return parseDay(k).toLocaleDateString(undefined, { weekday: 'long' });
  return fmtDay(k, { day: 'numeric', month: 'short', year: parseDay(k).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed : hash(String(seed));
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const shuffle = (arr, r = Math.random) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export const numWord = (n) => (n >= 0 && n <= 10 ? words[n] : String(n));
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
