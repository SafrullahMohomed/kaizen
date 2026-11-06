// Generative cover art. Each area has its own visual metaphor:
//   leadership  — ripples spreading from one point (influence)
//   learning    — a retention curve that resets at ever-wider review gaps (spacing)
//   engineering — modules wired together (systems)
// Art is deterministic: the same idea id always draws the same picture.
import { rng } from './util.js';

export const PALETTE = {
  leadership: { bg: '#3B2A07', deep: '#2A1C04', mid: '#C97F12', hi: '#F2B33D', light: '#FFF1CC' },
  learning: { bg: '#0A4F4E', deep: '#073B3A', mid: '#1E8F8B', hi: '#8FE0D3', light: '#F3FBFA' },
  engineering: { bg: '#262A78', deep: '#1B1E5C', mid: '#5A60C8', hi: '#A9AFFF', light: '#F4F5FF' },
};

const f = (n) => Math.round(n * 10) / 10;

function ripples(r, w, h, p) {
  const ox = w * (0.12 + 0.76 * r());
  const oy = h * (r() < 0.5 ? 0.15 + 0.25 * r() : 0.6 + 0.3 * r());
  const step = 14 + r() * 12;
  const n = Math.ceil(Math.hypot(w, h) / step);
  let s = '';
  for (let k = n; k >= 1; k--) {
    const rad = 6 + k * step;
    const strong = k % 3 === 0;
    const op = Math.max(0.12, 1 - k / (n * 0.9));
    s += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(rad)}" fill="none" stroke="${strong ? p.hi : p.mid}" stroke-width="${strong ? 2.6 : 1.3}" opacity="${f(op)}"/>`;
  }
  const people = 4 + Math.floor(r() * 4);
  for (let i = 0; i < people; i++) {
    const k = 2 + Math.floor(r() * Math.min(9, n - 1));
    const a = r() * Math.PI * 2;
    const x = ox + Math.cos(a) * (6 + k * step);
    const y = oy + Math.sin(a) * (6 + k * step);
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3 + r() * 3)}" fill="${p.light}" opacity="${f(0.55 + r() * 0.45)}"/>`;
  }
  s += `<circle cx="${f(ox)}" cy="${f(oy)}" r="9" fill="${p.hi}"/>`;
  return s;
}

function spacing(r, w, h, p) {
  const top = h * (0.16 + r() * 0.06);
  const base = h * 0.84;
  let s = '';
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 16; x++)
      s += `<circle cx="${f((x + 0.5) * (w / 16))}" cy="${f(top + (y * (base - top)) / 5)}" r="1.1" fill="${p.light}" opacity="0.14"/>`;
  s += `<line x1="0" y1="${f(base)}" x2="${w}" y2="${f(base)}" stroke="${p.hi}" stroke-width="1" opacity="0.35"/>`;
  const growth = 1.45 + r() * 0.35;
  let gap = w * (0.07 + r() * 0.04);
  let t = w * (0.04 + r() * 0.05);
  let tau = 0.35;
  let d = `M0 ${f(base - (base - top) * 0.2)} L${f(t)} ${f(top)}`;
  const peaks = [[t, top]];
  while (t < w) {
    const end = Math.min(w + 4, t + gap);
    for (let x = t; x <= end; x += 4) {
      const y = top + (base - top) * 0.8 * (1 - Math.exp(-((x - t) / gap) / tau));
      d += ` L${f(x)} ${f(y)}`;
    }
    t = end;
    if (t < w) {
      d += ` L${f(t)} ${f(top)}`;
      peaks.push([t, top]);
    }
    gap *= growth;
    tau *= 1.55;
  }
  s += `<path d="${d}" fill="none" stroke="${p.hi}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const [x, y] of peaks) {
    s += `<line x1="${f(x)}" y1="${f(y)}" x2="${f(x)}" y2="${f(base)}" stroke="${p.light}" stroke-width="1" opacity="0.25"/>`;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="5" fill="${p.light}"/>`;
  }
  return s;
}

function modules(r, w, h, p) {
  const cols = 7;
  const rows = 4;
  const cw = w / cols;
  const ch = h / rows;
  const used = Array.from({ length: rows }, () => Array(cols).fill(false));
  const blocks = [];
  const want = 5 + Math.floor(r() * 4);
  let tries = 0;
  while (blocks.length < want && tries++ < 200) {
    const bw = r() < 0.35 ? 2 : 1;
    const bh = r() < 0.25 ? 2 : 1;
    const cx = Math.floor(r() * (cols - bw + 1));
    const cy = Math.floor(r() * (rows - bh + 1));
    let free = true;
    for (let y = cy; y < cy + bh; y++) for (let x = cx; x < cx + bw; x++) if (used[y][x]) free = false;
    if (!free) continue;
    for (let y = cy; y < cy + bh; y++) for (let x = cx; x < cx + bw; x++) used[y][x] = true;
    blocks.push({ x: cx * cw + 7, y: cy * ch + 7, w: bw * cw - 14, h: bh * ch - 14 });
  }
  blocks.sort((a, b) => a.x - b.x || a.y - b.y);
  let s = '';
  for (let i = 0; i < blocks.length - 1; i++) {
    const a = blocks[i];
    const b = blocks[i + 1];
    const ax = a.x + a.w / 2;
    const ay = a.y + a.h / 2;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    s += `<path d="M${f(ax)} ${f(ay)} H${f((ax + bx) / 2)} V${f(by)} H${f(bx)}" fill="none" stroke="${p.hi}" stroke-width="1.6" opacity="0.55"/>`;
  }
  const accent = Math.floor(r() * blocks.length);
  blocks.forEach((b, i) => {
    const filled = r() < 0.5;
    const fill = i === accent ? PALETTE.leadership.hi : filled ? p.hi : p.bg;
    s += `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}" rx="7" fill="${fill}" stroke="${i === accent ? 'none' : p.light}" stroke-width="${filled ? 0 : 1.6}"/>`;
    if (!filled && i !== accent && b.w > 40) {
      for (let k = 0; k < 2; k++)
        s += `<line x1="${f(b.x + 10)}" y1="${f(b.y + 14 + k * 9)}" x2="${f(b.x + b.w * (0.4 + r() * 0.4))}" y2="${f(b.y + 14 + k * 9)}" stroke="${p.light}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`;
    }
  });
  return s;
}

const DRAW = { leadership: ripples, learning: spacing, engineering: modules };

export function art(seed, topic, { w = 400, h = 240 } = {}) {
  const p = PALETTE[topic] || PALETTE.engineering;
  const r = rng(seed + ':' + topic);
  const body = (DRAW[topic] || modules)(r, w, h, p);
  return `<svg class="art-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="${w}" height="${h}" fill="${p.bg}"/>${body}</svg>`;
}

/* ---------- Interface icons (24px, stroke) ---------- */
const P = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z"/>',
  review: '<rect x="3.5" y="7.5" width="13" height="13" rx="2.5"/><path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5V16"/>',
  library: '<path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z"/>',
  me: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.3-3.7 4.2-5.6 7.5-5.6s6.2 1.9 7.5 5.6"/>',
  save: '<path d="M6.5 3.5h11v17l-5.5-3.8-5.5 3.8z"/>',
  try: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  reflect: '<path d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0 0-3L18.3 4.5a2.1 2.1 0 0 0-3 0L4 15.8z"/><path d="m13.5 6.5 4 4"/>',
  listen: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  share: '<path d="M12 3.5v11.5M7.5 8 12 3.5 16.5 8"/><path d="M5.5 12.5v6.2A1.8 1.8 0 0 0 7.3 20.5h9.4a1.8 1.8 0 0 0 1.8-1.8v-6.2"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  flame: '<path d="M12 3c.6 2.6 3.2 4.6 4.4 7.4A5.2 5.2 0 0 1 12 21a5.1 5.1 0 0 1-5-5.2c0-1.9.9-3.3 2.2-4.4.1 1.8 1 3 2.3 3.3-.6-3.4-.4-6.3.5-11.7z"/>',
  trash: '<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  edit: '<path d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0 0-3L18.3 4.5a2.1 2.1 0 0 0-3 0L4 15.8z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>',
  journal: '<path d="M6 3.5h11.5v17H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5z"/><path d="M8.5 8h6M8.5 11.5h6"/>',
};

export const icon = (name, { size = 24, filled = false, cls = '' } = {}) =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[name] || ''}</svg>`;
