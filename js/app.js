// Boot, routing and event wiring.
import { esc, plural, isIOS, isStandalone } from './util.js';
import { C, loadContent, mergeUserIdeas } from './content.js';
import * as S from './store.js';
import * as V from './views.js';
import { openReader, readerOpen } from './reader.js';
import { openReview, openQuiz, studyOpen } from './review.js';
import { toast, sheet, closeSheet, confirmSheet } from './ui.js';
import { stashSheet, reflectSheet, actionDoneSheet, ideaEditorSheet } from './sheets.js';

const view = document.getElementById('view');
const tabs = document.getElementById('tabs');

/* ---------- theme ---------- */
function applyTheme() {
  const t = S.state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0F1521' : '#EEF1F4');
}

/* ---------- routing ---------- */
const route = () => {
  const h = location.hash.replace(/^#\/?/, '') || 'today';
  const [name, arg] = h.split('/');
  return { name, arg };
};

let lastRouteKey = '';
export function render() {
  if (!C.loaded) return;
  if (readerOpen() || studyOpen()) return; // re-render after the overlay closes
  V.resetLists();
  if (!S.state.profile.onboarded) {
    document.body.classList.add('no-tabs');
    view.innerHTML = V.onboarding();
    return;
  }
  document.body.classList.remove('no-tabs');
  const { name, arg } = route();
  const key = location.hash;
  let html;
  let tab = name;
  switch (name) {
    case 'today': html = V.today(); break;
    case 'explore': html = V.explore(); break;
    case 'source': html = V.sourcePage(arg); tab = 'explore'; break;
    case 'journey': html = V.journeyPage(arg); tab = 'explore'; break;
    case 'review': html = V.review(); break;
    case 'library': html = V.library(arg || 'stashes'); break;
    case 'stash': html = V.stashPage(arg); tab = 'library'; break;
    case 'me': html = V.me(); break;
    default: html = V.notFound(); tab = '';
  }
  view.innerHTML = html;
  tabs.querySelectorAll('a').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === tab ? 'page' : 'false'));
  if (key !== lastRouteKey) {
    window.scrollTo(0, 0);
    lastRouteKey = key;
  }
}

window.addEventListener('hashchange', render);
S.onChange(() => render());

/* ---------- overlays ---------- */
function afterOverlay() {
  render();
  showBadges();
}
function showBadges() {
  if (!S.pendingBadges.length) return;
  const ids = S.pendingBadges.splice(0);
  const names = ids.map((id) => S.BADGES.find((b) => b[0] === id)?.[1]).filter(Boolean);
  if (!names.length) return;
  const msg = names.length === 1 ? `Badge earned: ${names[0]}` : names.length === 2 ? `Badges earned: ${names[0]} and ${names[1]}` : `${names.length} new badges`;
  setTimeout(() => toast(msg, { action: 'See badges', onAction: () => (location.hash = '#/me'), ms: 3800 }), 350);
}

function openList(key, idx) {
  const l = V.lists.get(key);
  if (!l) return;
  openReader(l.ids, {
    start: Number(idx) || 0,
    ctx: l.ctx,
    onClose: afterOverlay,
    onMore: readMoreToday,
    onReview: startReview,
  });
}
function readMoreToday() {
  const added = S.morePicks();
  if (!added.length) { render(); return toast('You have read every idea in your areas. Add more areas, or write your own.'); }
  const ids = S.state.picks.ids;
  openReader(ids, { start: ids.indexOf(added[0]), ctx: { kind: 'today', label: "today's ideas" }, onClose: afterOverlay, onMore: readMoreToday, onReview: startReview });
}
function startReview() {
  const due = S.dueIds();
  if (!due.length) return toast('Nothing is due right now');
  openReview({ ids: due, onClose: afterOverlay });
}

/* ---------- actions (event delegation) ---------- */
const actions = {
  'open-list': (el) => openList(el.dataset.list, el.dataset.idx),
  'more-today': () => readMoreToday(),
  'start-review': () => startReview(),
  'start-quiz': () => openQuiz({ onClose: afterOverlay }),
  'action-done': (el) => actionDoneSheet(el.dataset.id, { onDone: render }),
  'action-remove': (el) => { S.removeAction(el.dataset.id); toast('Action removed'); },
  'filter-topic': (el) => { V.exploreState.topic = el.dataset.id; render(); },
  'start-journey': (el) => { S.startJourney(el.dataset.id); openList(el.dataset.list, el.dataset.idx); },
  'stop-journey': () => { S.stopJourney(); toast('Stopped following this journey'); },
  'new-stash': () => {
    sheet(`<h2 class="sheet-title">New stash</h2><form data-form><input class="field" name="name" maxlength="40" placeholder="e.g. Team 1:1s, System design" autofocus aria-label="Stash name">
      <div class="sheet-actions"><button class="btn btn-primary" type="submit">Create stash</button><button class="btn btn-quiet" data-close type="button">Cancel</button></div></form>`, {
      label: 'New stash',
      onOpen: (el, close) => el.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = e.target.elements.name.value.trim();
        if (!v) return;
        const s = S.createStash(v);
        close();
        location.hash = '#/stash/' + s.id;
      }),
    });
  },
  'rename-stash': (el) => {
    const s = S.state.stashes.find((x) => x.id === el.dataset.id);
    sheet(`<h2 class="sheet-title">Rename stash</h2><form data-form><input class="field" name="name" maxlength="40" value="${esc(s.name)}" autofocus aria-label="Stash name">
      <div class="sheet-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-quiet" data-close type="button">Cancel</button></div></form>`, {
      label: 'Rename stash',
      onOpen: (sh, close) => sh.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); S.renameStash(s.id, e.target.elements.name.value); close(); }),
    });
  },
  'delete-stash': async (el) => {
    const s = S.state.stashes.find((x) => x.id === el.dataset.id);
    if (await confirmSheet({ title: `Delete “${s.name}”?`, body: 'The ideas stay in your library; only this stash is removed.', confirm: 'Delete stash', danger: true })) {
      S.deleteStash(s.id);
      location.hash = '#/library/stashes';
    }
  },
  'new-idea': () => ideaEditorSheet(null, { onDone: render }),
  'edit-idea': (el) => {
    const u = S.state.userIdeas.find((x) => x.id === el.dataset.id);
    if (!u) return;
    sheet(`<h2 class="sheet-title">${esc(u.title)}</h2><div class="sheet-actions">
      <button class="btn btn-primary" data-edit type="button">Edit idea</button>
      <button class="btn btn-danger" data-del type="button">Delete idea</button>
      <button class="btn btn-quiet" data-close type="button">Cancel</button></div>`, {
      label: 'Your idea',
      onOpen: (sh, close) => {
        sh.querySelector('[data-edit]').addEventListener('click', () => { close(); setTimeout(() => ideaEditorSheet(u, { onDone: render }), 280); });
        sh.querySelector('[data-del]').addEventListener('click', () => { S.deleteUserIdea(u.id); close(); toast('Idea deleted'); });
      },
    });
  },
  'new-reflection': () => reflectSheet(null),
  'delete-journal': async (el) => {
    if (await confirmSheet({ title: 'Delete this entry?', confirm: 'Delete', danger: true })) S.deleteJournal(el.dataset.id);
  },
  'set-goal': (el) => { S.setGoal(Number(el.dataset.v)); toast(`Daily goal: ${plural(Number(el.dataset.v), 'idea')}`); },
  'set-review-mode': (el) => { S.state.profile.reviewMode = el.dataset.v; S.commit(); },
  'set-theme': (el) => { S.state.settings.theme = el.dataset.v; applyTheme(); S.commit(); },
  'edit-areas': () => {
    sheet(V.areasSheetHTML(), {
      label: 'Areas and interests',
      onOpen: (sh, close) => sh.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const topics = fd.getAll('topic');
        if (!topics.length) return toast('Choose at least one area');
        S.setAreas(topics, fd.getAll('focus'));
        close();
        toast("Today's list updated");
      }),
    });
  },
  'check-content': async () => {
    try {
      const before = C.contentVersion;
      await loadContent();
      mergeUserIdeas(S.state.userIdeas);
      const added = S.syncKnownIds();
      render();
      toast(added.length ? `${plural(added.length, 'new idea')} added` : C.contentVersion !== before ? 'Library updated' : 'You have the latest ideas');
    } catch {
      toast('Couldn’t reach the server. Try again when you’re online.');
    }
  },
  export: () => exportData(),
  import: () => view.querySelector('[data-import]')?.click(),
  'install-help': () => sheet(V.installSheetHTML(), { label: 'Add to Home Screen' }),
  reset: async () => {
    if (await confirmSheet({ title: 'Erase everything?', body: 'This deletes your progress, stashes, journal and your own ideas on this device. Back up first if you might want them.', confirm: 'Erase everything', danger: true })) {
      S.resetAll();
      location.hash = '#/today';
      location.reload();
    }
  },
  /* onboarding */
  'ob-next': () => {
    const order = ['welcome', ...(V.needsInstallStep() ? ['install'] : []), 'topics', 'goal'];
    V.ob.step = order[order.indexOf(V.ob.step) + 1] || 'goal';
    render();
    window.scrollTo(0, 0);
  },
  'ob-topic': (el) => {
    const id = el.dataset.id;
    V.ob.topics = V.ob.topics.includes(id) ? V.ob.topics.filter((x) => x !== id) : [...V.ob.topics, id];
    render();
  },
  'ob-focus': (el) => {
    const id = el.dataset.id;
    V.ob.focus = V.ob.focus.includes(id) ? V.ob.focus.filter((x) => x !== id) : [...V.ob.focus, id];
    render();
  },
  'ob-goal': (el) => { V.ob.goal = Number(el.dataset.n); render(); },
  'ob-finish': () => {
    const p = S.state.profile;
    p.topics = V.ob.topics.length ? V.ob.topics : ['leadership', 'learning', 'engineering'];
    p.focus = V.ob.focus;
    p.dailyGoal = V.ob.goal;
    p.onboarded = true;
    S.state.picks = { date: null, ids: [] };
    S.commit({ quiet: true });
    navigator.storage?.persist?.().catch(() => {});
    location.hash = '#/today';
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  if (el.closest('#sheet-root')) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) {
    e.preventDefault();
    e.target.click();
  }
});

/* search: handled in place so the input keeps focus */
let searchTimer;
document.addEventListener('input', (e) => {
  if (!e.target.closest('[data-search]')) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    V.exploreState.q = e.target.value.trim();
    const box = view.querySelector('[data-results]');
    if (!box) return;
    if (V.exploreState.q) box.innerHTML = V.searchResults(V.exploreState.q);
    else render();
  }, 160);
});
document.addEventListener('submit', (e) => {
  if (e.target.matches('[data-search]')) { e.preventDefault(); e.target.querySelector('input')?.blur(); }
});
document.addEventListener('change', async (e) => {
  if (!e.target.matches('[data-import]')) return;
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'kaizen' || !data.state) throw new Error('not a backup');
    const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : 'an unknown date';
    if (!(await confirmSheet({ title: 'Restore this backup?', body: `Made on ${when}. Everything currently on this device will be replaced.`, confirm: 'Restore' }))) return;
    S.replaceState(data.state);
    location.reload();
  } catch {
    toast('That file isn’t a Kaizen backup');
  }
});

async function exportData() {
  S.persist();
  const payload = JSON.stringify({ app: 'kaizen', version: S.APP_VERSION, exportedAt: new Date().toISOString(), state: S.state }, null, 1);
  const name = `kaizen-backup-${S.today()}.json`;
  const file = new File([payload], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Kaizen backup' });
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup saved');
}

/* ---------- service worker and updates ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const prompt = (w) =>
      toast('A new version of Kaizen is ready', { action: 'Update', ms: 15000, onAction: () => w.postMessage('skip-waiting') });
    if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

/* ---------- day rollover while the app stays open ---------- */
let lastDay = S.today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (S.today() !== lastDay) {
    lastDay = S.today();
    render();
  }
});

/* ---------- boot ---------- */
async function boot() {
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
  view.innerHTML = V.loading();
  try {
    await loadContent();
  } catch (e) {
    view.innerHTML = V.loading('Couldn’t load the idea library. Check your connection and reopen the app.');
    console.error(e);
    return;
  }
  mergeUserIdeas(S.state.userIdeas);
  const added = S.syncKnownIds();
  if (S.state.profile.onboarded && !location.hash) location.replace('#/today');
  render();
  if (added.length && S.state.profile.onboarded) toast(`${plural(added.length, 'new idea')} just arrived`, { action: 'Explore', onAction: () => (location.hash = '#/explore'), ms: 5000 });
  registerSW();
}

window.__kaizen = { S, C, render }; // handy for debugging in Safari's Web Inspector

boot();
