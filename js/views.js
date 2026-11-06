// Screens. Each returns an HTML string; app.js wires behavior via data-act.
import { esc, plural, numWord, cap, fmtDay, relDay, dayKey, addDays, parseDay, isIOS, isStandalone } from './util.js';
import { art, icon } from './art.js';
import { C, sourceLine, search } from './content.js';
import * as S from './store.js';

/* ---------- list registry: rows open the reader with their list as context ---------- */
export const lists = new Map();
let listSeq = 0;
export function reg(ids, ctx) {
  const key = 'l' + listSeq++;
  lists.set(key, { ids, ctx });
  return key;
}
export const resetLists = () => { lists.clear(); listSeq = 0; };

const topicName = (t) => C.topicById.get(t)?.name || '';

export const tile = (seed, topic, cls = '') => `<span class="tile t-${topic} ${cls}" aria-hidden="true">${art(seed, topic, { w: 120, h: 120 })}</span>`;

const firstSentence = (s) => (s.split(/\n/)[0].match(/^.*?[.!?](\s|$)/)?.[0] || s).trim();

function ideaRow(i, list, idx, { sub = 'source', extra = '' } = {}) {
  const read = S.isRead(i.id);
  const text = sub === 'topic' ? topicName(i.topic) : sub === 'gist' ? firstSentence(i.body) : sourceLine(i);
  return `<li class="${extra ? 'has-extra' : ''}"><button type="button" class="row" data-act="open-list" data-list="${list}" data-idx="${idx}">
    ${tile(i.id, i.topic)}
    <span class="row-main"><span class="row-title">${esc(i.title)}</span><span class="row-sub">${esc(text)}</span></span>
    ${S.isNew(i.id) ? '<span class="tag-new">New</span>' : ''}
    ${read ? `<span class="row-done" aria-label="Read">${icon('check', { size: 18 })}</span>` : ''}
  </button>${extra}</li>`;
}

const header = (title, { back = null, right = '' } = {}) => `<header class="hdr">
  ${back ? `<a class="back" href="${back}" aria-label="Back">${icon('back')}<span>Back</span></a>` : ''}
  <div class="hdr-row"><h1 class="display">${esc(title)}</h1>${right}</div></header>`;

const streakChip = () => {
  const s = S.streak();
  return `<a class="streak ${s ? 'on' : ''}" href="#/me" aria-label="${plural(s, 'day')} streak">${icon('flame', { size: 18, filled: s > 0 })}<span>${s}</span></a>`;
};

/* ================= Onboarding ================= */
export const ob = { step: 'welcome', topics: ['leadership', 'learning', 'engineering'], focus: [], goal: 5 };

export function onboarding() {
  const s = ob.step;
  if (s === 'welcome') {
    return `<div class="ob">
      <div class="ob-hero" aria-hidden="true">${['leadership', 'learning', 'engineering'].map((t, n) => `<div class="ob-art t-${t}" style="--n:${n}">${art('hero-' + t, t)}</div>`).join('')}</div>
      <h1 class="ob-title">Kaizen</h1>
      <p class="ob-text">Small ideas on leadership, learning and software engineering. A few minutes a day, with reviews that make them stick and actions that make them real.</p>
      <div class="ob-actions"><button class="btn btn-primary btn-wide" data-act="ob-next" type="button">Get started</button></div>
    </div>`;
  }
  if (s === 'install') {
    return `<div class="ob">
      <h1 class="ob-title sm">Put Kaizen on your Home Screen</h1>
      <p class="ob-text">It opens full screen, works offline, and keeps your progress in one place.</p>
      <ol class="steps">
        <li><span class="step-n">1</span><span>Tap the Share button ${icon('share', { size: 18 })} in Safari's toolbar.</span></li>
        <li><span class="step-n">2</span><span>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
        <li><span class="step-n">3</span><span>Open Kaizen from your Home Screen and set it up there.</span></li>
      </ol>
      <p class="ob-note">Your progress is saved on your iPhone, inside the Home Screen app. Safari keeps a separate copy, so set things up after opening the app from the icon.</p>
      <div class="ob-actions"><button class="btn btn-quiet btn-wide" data-act="ob-next" type="button">Continue in Safari instead</button></div>
    </div>`;
  }
  if (s === 'topics') {
    const focusFor = Object.entries(C.focus).filter(([k]) =>
      [...C.sources.values()].some((src) => src.focus === k && ob.topics.includes(src.topic))
    );
    return `<div class="ob">
      <p class="ob-step">Step 1 of 2</p>
      <h1 class="ob-title sm">What do you want to grow?</h1>
      <ul class="choice-list">${C.topics
        .map((t) => `<li><button type="button" class="choice" data-act="ob-topic" data-id="${t.id}" aria-pressed="${ob.topics.includes(t.id)}">
          ${tile('choice-' + t.id, t.id)}<span class="row-main"><span class="row-title">${esc(t.name)}</span><span class="row-sub">${esc(t.blurb)}</span></span>
          <span class="tick">${icon('check', { size: 18 })}</span></button></li>`)
        .join('')}</ul>
      <h2 class="sec">Anything in particular? <span class="muted">Optional</span></h2>
      <div class="chips">${focusFor
        .map(([k, v]) => `<button type="button" class="chip" data-act="ob-focus" data-id="${k}" aria-pressed="${ob.focus.includes(k)}">${esc(v)}</button>`)
        .join('')}</div>
      <div class="ob-actions sticky"><button class="btn btn-primary btn-wide" data-act="ob-next" type="button" ${ob.topics.length ? '' : 'disabled'}>Continue</button></div>
    </div>`;
  }
  // goal
  const opts = [
    [3, 'About 2 minutes a day'],
    [5, 'About 4 minutes a day'],
    [10, 'About 8 minutes a day'],
  ];
  return `<div class="ob">
    <p class="ob-step">Step 2 of 2</p>
    <h1 class="ob-title sm">How many ideas a day?</h1>
    <ul class="choice-list">${opts
      .map(([n, t]) => `<li><button type="button" class="choice" data-act="ob-goal" data-n="${n}" aria-pressed="${ob.goal === n}">
        <span class="goal-n">${n}</span><span class="row-main"><span class="row-title">${cap(numWord(n))} ideas</span><span class="row-sub">${t}</span></span>
        <span class="tick">${icon('check', { size: 18 })}</span></button></li>`)
      .join('')}</ul>
    <p class="ob-note">Reaching your goal keeps your streak going. Ideas you read come back in Review a day later, then at growing intervals.</p>
    <div class="ob-actions sticky"><button class="btn btn-primary btn-wide" data-act="ob-finish" type="button">Start reading</button></div>
  </div>`;
}
export const needsInstallStep = () => isIOS() && !isStandalone();

/* ================= Today ================= */
export function today() {
  const ids = S.ensurePicks();
  const readNow = S.dayRec().ids;
  const done = readNow.length;
  const g = S.goal();
  const left = Math.max(0, g - done);
  const firstUnread = ids.findIndex((id) => !readNow.includes(id) && !S.isRead(id));
  const anyUnreadIdx = firstUnread >= 0 ? firstUnread : ids.findIndex((id) => !readNow.includes(id));
  const L = reg(ids, { kind: 'today', label: "today's ideas" });

  const headline = left === 0 ? 'Daily goal done.' : left === 1 ? 'One idea to go today.' : `${cap(numWord(left))} ideas to go today.`;
  const btn = anyUnreadIdx < 0
    ? `<button class="btn btn-light" data-act="more-today" type="button">Read ${numWord(g)} more</button>`
    : `<button class="btn btn-light" data-act="open-list" data-list="${L}" data-idx="${anyUnreadIdx}" type="button">${done === 0 ? "Start today's ideas" : 'Continue reading'}</button>`;

  const segs = Array.from({ length: Math.max(g, ids.length) }, (_, n) => {
    const id = ids[n];
    const topic = id ? C.ideas.get(id)?.topic : '';
    const on = n < done;
    return `<i class="seg ${on ? 'on' : ''} t-${topic}"></i>`;
  }).join('');

  const due = S.dueIds().length;
  const next = S.nextDueSummary();
  const actions = S.openActions().slice(0, 4);
  const aj = S.state.activeJourney && C.journeys.get(S.state.activeJourney);

  return `${header(fmtDay(dayKey()), { right: streakChip() })}
  <section class="goal">
    <h2 class="goal-title">${headline}</h2>
    <div class="segs" role="img" aria-label="${done} of ${g} ideas read today">${segs}</div>
    <div class="goal-actions">${btn}</div>
  </section>

  <h2 class="sec">Today's ideas</h2>
  <ul class="group">${ids.map((id, n) => ideaRow(C.ideas.get(id), L, n)).join('')}</ul>

  <h2 class="sec">Review</h2>
  <div class="group pad">
    ${due
      ? `<div class="line"><div><p class="line-title">${plural(due, 'card')} to review</p><p class="row-sub">A minute of recall keeps ideas from fading.</p></div>
         <button class="btn btn-primary btn-sm" data-act="start-review" type="button">Review</button></div>`
      : `<p class="line-title">${Object.keys(S.state.srs).length ? "You're all caught up." : 'Nothing to review yet.'}</p>
         <p class="row-sub">${next ? `Next review: ${relDay(next)}.` : 'Ideas you read today come back tomorrow.'}</p>`}
  </div>

  <h2 class="sec">Today's actions</h2>
  ${actions.length
    ? `<ul class="group">${actions.map(actionRow).join('')}</ul>${S.openActions().length > 4 ? `<a class="more-link" href="#/library/journal">See all ${S.openActions().length} actions</a>` : ''}`
    : `<div class="group pad"><p class="row-sub">Tap <b>Try it</b> on any idea to turn it into a small action for today.</p></div>`}

  <h2 class="sec">Journey</h2>
  ${aj ? journeyCard(aj, true) : `<a class="group pad link-row" href="#/explore"><span><span class="line-title">Follow a journey</span><span class="row-sub">A guided path through ideas on one theme, a little each day.</span></span>${icon('next', { size: 18 })}</a>`}
  `;
}

export function actionRow(a) {
  const i = C.ideas.get(a.ideaId);
  return `<li class="act-row">
    <button type="button" class="check" data-act="action-done" data-id="${a.id}" aria-label="Mark done: ${esc(a.text)}"></button>
    <div class="row-main"><span class="act-text">${esc(a.text)}</span>${i ? `<span class="row-sub">From “${esc(i.title)}”</span>` : ''}</div>
    <button type="button" class="icon-btn" data-act="action-remove" data-id="${a.id}" aria-label="Remove action">${icon('close', { size: 18 })}</button>
  </li>`;
}

function journeyCard(j, wide = false) {
  const p = S.journeyProgress(j.id);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return `<a class="jcard ${wide ? 'wide' : ''} t-${j.topic}" href="#/journey/${j.id}">
    <span class="jcard-art">${art('j-' + j.id, j.topic, { w: 320, h: 140 })}</span>
    <span class="jcard-body"><span class="jcard-title">${esc(j.title)}</span>
    <span class="row-sub">${p.done ? `${p.done} of ${p.total} read` : `${plural(p.total, 'idea')}`}</span>
    <span class="bar"><i style="width:${pct}%"></i></span></span></a>`;
}

/* ================= Explore ================= */
export const exploreState = { topic: 'all', q: '' };

export function explore() {
  const t = exploreState.topic;
  const chips = [['all', 'All'], ...C.topics.map((x) => [x.id, x.name])]
    .map(([id, n]) => `<button type="button" class="chip" data-act="filter-topic" data-id="${id}" aria-pressed="${t === id}">${esc(n)}</button>`)
    .join('');
  return `${header('Explore')}
  <form class="searchbar" role="search" data-search>
    ${icon('search', { size: 18 })}
    <input type="search" name="q" placeholder="Search ideas, books and authors" value="${esc(exploreState.q)}" aria-label="Search" autocomplete="off" enterkeyhint="search">
  </form>
  <div data-results>${exploreState.q ? searchResults(exploreState.q) : browse(t, chips)}</div>`;
}

function browse(t, chips) {
  const topics = t === 'all' ? C.topics.map((x) => x.id) : [t];
  const js = [...C.journeys.values()].filter((j) => topics.includes(j.topic));
  const groups = topics
    .map((tp) => {
      const srcs = [...C.sources.values()].filter((s) => s.topic === tp);
      return `<h2 class="sec">${esc(topicName(tp))}</h2><ul class="group">${srcs.map(sourceRow).join('')}</ul>`;
    })
    .join('');
  return `<div class="chips scroll">${chips}</div>
  <h2 class="sec">Journeys</h2>
  <div class="hscroll">${js.map((j) => journeyCard(j)).join('')}</div>
  ${groups}`;
}

function sourceRow(s) {
  const read = s.ideaIds.filter((id) => S.isRead(id)).length;
  const fresh = s.ideaIds.some((id) => S.isNew(id));
  return `<li><a class="row" href="#/source/${s.id}">
    ${tile(s.id, s.topic)}
    <span class="row-main"><span class="row-title">${esc(s.title)}</span><span class="row-sub">${esc(s.author)}</span></span>
    ${fresh ? '<span class="tag-new">New</span>' : ''}
    <span class="row-meta">${read ? `${read}/${s.ideaIds.length}` : s.ideaIds.length}</span>
  </a></li>`;
}

export function searchResults(q) {
  const res = search(q).slice(0, 60);
  if (!res.length) return `<div class="empty"><p class="line-title">No ideas match “${esc(q)}”.</p><p class="row-sub">Try a shorter word, a book title or an author.</p></div>`;
  const L = reg(res.map((i) => i.id), { kind: 'list', label: 'these results' });
  return `<h2 class="sec">${plural(res.length, 'idea')}</h2><ul class="group">${res.map((i, n) => ideaRow(i, L, n)).join('')}</ul>`;
}

/* ================= Source ================= */
export function sourcePage(id) {
  const s = C.sources.get(id);
  if (!s) return notFound();
  const ids = s.ideaIds;
  const L = reg(ids, { kind: 'list', label: s.title });
  const read = ids.filter((x) => S.isRead(x)).length;
  const first = ids.findIndex((x) => !S.isRead(x));
  return `${header('', { back: '#/explore' })}
  <div class="hero-art t-${s.topic}">${art(s.id, s.topic, { w: 400, h: 200 })}</div>
  <p class="kicker">${esc(topicName(s.topic))}, ${esc(C.focus[s.focus] || '')}</p>
  <h1 class="display">${esc(s.title)}</h1>
  ${/^common/i.test(s.author) ? '' : `<p class="byline">${esc(s.author)}${s.year && s.type !== 'concept' ? `, ${s.year}` : ''}</p>`}
  <p class="lede">${esc(s.intro)}</p>
  <div class="cta-row"><button class="btn btn-primary" data-act="open-list" data-list="${L}" data-idx="${first < 0 ? 0 : first}" type="button">${read === 0 ? 'Start reading' : first < 0 ? 'Read again' : 'Continue reading'}</button>
  <span class="row-sub">${read} of ${plural(ids.length, 'idea')} read</span></div>
  <ul class="group">${ids.map((x, n) => ideaRow(C.ideas.get(x), L, n, { sub: 'gist' })).join('')}</ul>`;
}

/* ================= Journey ================= */
export function journeyPage(id) {
  const j = C.journeys.get(id);
  if (!j) return notFound();
  const L = reg(j.ideas, { kind: 'list', label: 'this journey' });
  const p = S.journeyProgress(id);
  const first = j.ideas.findIndex((x) => !S.isRead(x));
  const active = S.state.activeJourney === id;
  return `${header('', { back: '#/explore' })}
  <div class="hero-art t-${j.topic}">${art('j-' + j.id, j.topic, { w: 400, h: 200 })}</div>
  <p class="kicker">Journey in ${esc(topicName(j.topic))}</p>
  <h1 class="display">${esc(j.title)}</h1>
  <p class="lede">${esc(j.blurb)}</p>
  ${j.learn?.length ? `<h2 class="sec">What you'll learn</h2><ul class="learn">${j.learn.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
  <div class="bar big"><i style="width:${p.total ? (p.done / p.total) * 100 : 0}%"></i></div>
  <p class="row-sub">${p.done} of ${plural(p.total, 'idea')} read${active ? '. Following: one idea from this journey joins your daily list.' : ''}</p>
  <div class="cta-row">
    <button class="btn btn-primary" data-act="start-journey" data-id="${j.id}" data-list="${L}" data-idx="${first < 0 ? 0 : first}" type="button">${p.done === 0 ? 'Start journey' : first < 0 ? 'Read again' : 'Continue journey'}</button>
    ${active ? `<button class="btn btn-quiet" data-act="stop-journey" type="button">Stop following</button>` : ''}
  </div>
  <ul class="group">${j.ideas.map((x, n) => ideaRow(C.ideas.get(x), L, n)).join('')}</ul>`;
}

/* ================= Review ================= */
export function review() {
  const due = S.dueIds().length;
  const st = S.stats();
  const next = S.nextDueSummary();
  return `${header('Review')}
  <section class="goal review-hero">
    <p class="big-num">${due}</p>
    <h2 class="goal-title">${due === 1 ? 'card due today' : 'cards due today'}</h2>
    <p class="goal-sub">${due ? 'Recall each idea before you look. The harder it feels, the better it sticks.' : st.inReview ? `You're all caught up.${next ? ` Next review: ${relDay(next)}.` : ''}` : 'Ideas you read are added here and come back a day later.'}</p>
    <div class="goal-actions"><button class="btn btn-light" data-act="start-review" type="button" ${due ? '' : 'disabled'}>Start review</button></div>
  </section>
  <div class="group pad">
    <div class="line"><div><p class="line-title">Quick quiz</p><p class="row-sub">Five multiple-choice questions from ideas you've read.</p></div>
    <button class="btn btn-secondary btn-sm" data-act="start-quiz" type="button">Start</button></div>
  </div>
  <div class="stats3">
    <div><b>${st.inReview}</b><span>In review</span></div>
    <div><b>${st.mastered}</b><span>Mastered</span></div>
    <div><b>${st.reviews}</b><span>Reviews done</span></div>
  </div>
  <p class="note">Each time you remember an idea, it waits longer before coming back: one day, three days, a week, and so on. Once the gap reaches three weeks, the idea counts as mastered.</p>`;
}

/* ================= Library ================= */
const LIB_TABS = [
  ['stashes', 'Stashes'],
  ['history', 'History'],
  ['journal', 'Journal'],
  ['mine', 'My ideas'],
];
export function library(tab = 'stashes') {
  const seg = `<nav class="segmented" aria-label="Library sections">${LIB_TABS.map(([k, n]) => `<a href="#/library/${k}" aria-current="${k === tab ? 'page' : 'false'}">${n}</a>`).join('')}</nav>`;
  let body = '';
  if (tab === 'stashes') {
    body = `<ul class="group">${S.state.stashes
      .map((s) => {
        const first = s.ideas.map((id) => C.ideas.get(id)).filter(Boolean)[0];
        return `<li><a class="row" href="#/stash/${s.id}">${first ? tile(first.id, first.topic) : `<span class="tile empty-tile">${icon('save', { size: 20 })}</span>`}
        <span class="row-main"><span class="row-title">${esc(s.name)}</span><span class="row-sub">${plural(s.ideas.length, 'idea')}</span></span>${icon('next', { size: 18 })}</a></li>`;
      })
      .join('')}</ul>
      <button class="btn btn-secondary btn-wide" data-act="new-stash" type="button">${icon('plus', { size: 18 })} New stash</button>
      <p class="note">Group ideas for a purpose: a talk you're preparing, your next 1:1s, a design review.</p>`;
  } else if (tab === 'history') {
    const days = Object.entries(S.state.days)
      .filter(([, d]) => d.ids.length)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 90);
    body = days.length
      ? days
          .map(([k, d]) => {
            const ids = d.ids.filter((id) => C.ideas.has(id)).slice().reverse();
            const L = reg(ids, { kind: 'list', label: relDay(k).toLowerCase() === 'today' ? "today's reading" : `${relDay(k)}'s reading` });
            return `<h2 class="sec">${esc(relDay(k))} <span class="muted">${plural(ids.length, 'idea')}${d.met ? ', goal met' : ''}</span></h2>
            <ul class="group">${ids.map((id, n) => ideaRow(C.ideas.get(id), L, n)).join('')}</ul>`;
          })
          .join('')
      : `<div class="empty"><p class="line-title">Nothing read yet.</p><p class="row-sub">Everything you read shows up here, by day.</p></div>`;
  } else if (tab === 'journal') {
    const open = S.openActions();
    const entries = S.state.journal;
    body = `${open.length ? `<h2 class="sec">Open actions</h2><ul class="group">${open.map(actionRow).join('')}</ul>` : ''}
      <h2 class="sec">Entries</h2>
      ${entries.length
        ? `<ul class="journal">${entries
            .map((e) => {
              const i = e.ideaId && C.ideas.get(e.ideaId);
              const L = i ? reg([i.id], { kind: 'list', label: 'this idea' }) : null;
              return `<li class="entry">
                <p class="entry-meta">${e.kind === 'action' ? 'Action done' : 'Reflection'}, ${esc(relDay(dayKey(new Date(e.at))))}</p>
                ${e.action ? `<p class="entry-action">${esc(e.action)}</p>` : ''}
                <p class="entry-text">${esc(e.text)}</p>
                <div class="entry-foot">${i ? `<button type="button" class="link" data-act="open-list" data-list="${L}" data-idx="0">${esc(i.title)}</button>` : '<span></span>'}
                <button type="button" class="icon-btn" data-act="delete-journal" data-id="${e.id}" aria-label="Delete entry">${icon('trash', { size: 18 })}</button></div>
              </li>`;
            })
            .join('')}</ul>`
        : `<div class="empty"><p class="line-title">Your journal is empty.</p><p class="row-sub">Tap <b>Reflect</b> on an idea to write how it applies to your work, or finish an action and note how it went.</p></div>`}
      <button class="btn btn-secondary btn-wide" data-act="new-reflection" type="button">${icon('plus', { size: 18 })} New journal entry</button>`;
  } else {
    const mine = S.state.userIdeas.map((u) => C.ideas.get(u.id)).filter(Boolean);
    const L = reg(mine.map((i) => i.id), { kind: 'list', label: 'your ideas' });
    body = `${mine.length
      ? `<ul class="group">${mine.map((i, n) => ideaRow(i, L, n, { sub: 'topic', extra: `<button type="button" class="icon-btn row-edit" data-act="edit-idea" data-id="${i.id}" aria-label="Edit or delete ${esc(i.title)}">${icon('more', { size: 20 })}</button>` })).join('')}</ul>`
      : `<div class="empty"><p class="line-title">Write down ideas from your own reading.</p><p class="row-sub">Books, talks, a lesson from a hard week at work. They join your library and your reviews.</p></div>`}
      <button class="btn btn-primary btn-wide" data-act="new-idea" type="button">${icon('plus', { size: 18 })} Write an idea</button>`;
  }
  return `${header('Library')}${seg}${body}`;
}

export function stashPage(id) {
  const s = S.state.stashes.find((x) => x.id === id);
  if (!s) return notFound();
  const ids = s.ideas.filter((x) => C.ideas.has(x));
  const L = reg(ids, { kind: 'list', label: s.name });
  return `${header(s.name, { back: '#/library/stashes' })}
  <div class="cta-row">
    ${ids.length ? `<button class="btn btn-primary" data-act="open-list" data-list="${L}" data-idx="0" type="button">Read all ${ids.length}</button>` : ''}
    ${s.id !== 'saved' ? `<button class="btn btn-quiet" data-act="rename-stash" data-id="${s.id}" type="button">Rename</button>
    <button class="btn btn-quiet danger" data-act="delete-stash" data-id="${s.id}" type="button">Delete</button>` : ''}
  </div>
  ${ids.length
    ? `<ul class="group">${ids.map((x, n) => ideaRow(C.ideas.get(x), L, n)).join('')}</ul>
       <p class="note">To remove an idea, open it and tap Saved.</p>`
    : `<div class="empty"><p class="line-title">This stash is empty.</p><p class="row-sub">While reading, tap Save, then Add to stash.</p></div>`}`;
}

/* ================= Me ================= */
export function me() {
  const st = S.stats();
  const p = S.state.profile;
  const seg = (act, cur, opts) =>
    `<div class="seg-ctl" role="group">${opts.map(([v, n]) => `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${esc(n)}</button>`).join('')}</div>`;
  const earned = S.BADGES.filter(([id]) => S.state.badges[id]);
  return `${header('You')}
  <section class="streak-hero">
    <div class="streak-big">${icon('flame', { size: 30, filled: st.streak > 0 })}<b>${st.streak}</b></div>
    <p class="line-title">day streak</p>
    <p class="row-sub">${S.dayRec().met ? 'Goal met today. Come back tomorrow to keep it going.' : st.streak ? 'Reach today’s goal to keep it going.' : 'Reach your daily goal to start a streak.'} Best: ${plural(st.best, 'day')}.</p>
  </section>
  ${heatmap()}
  <div class="stats3 six">
    <div><b>${st.read}</b><span>Ideas read</span></div>
    <div><b>${st.mastered}</b><span>Mastered</span></div>
    <div><b>${st.saved}</b><span>Saved</span></div>
    <div><b>${st.actionsDone}</b><span>Actions done</span></div>
    <div><b>${st.reflections}</b><span>Journal entries</span></div>
    <div><b>${st.reviews}</b><span>Reviews</span></div>
  </div>

  <h2 class="sec">Badges <span class="muted">${earned.length} of ${S.BADGES.length}</span></h2>
  <ul class="badges">${S.BADGES.map(([id, name, desc]) => `<li class="badge ${S.state.badges[id] ? 'on' : ''}"><span class="badge-mark">${S.state.badges[id] ? icon('check', { size: 16 }) : ''}</span><span><b>${esc(name)}</b><span class="row-sub">${esc(desc)}</span></span></li>`).join('')}</ul>

  <h2 class="sec">Settings</h2>
  <div class="group pad settings">
    <div class="set"><p class="line-title">Daily goal</p>${seg('set-goal', p.dailyGoal, [[3, '3'], [5, '5'], [10, '10'], [15, '15']])}</div>
    <div class="set"><p class="line-title">Add to review</p>${seg('set-review-mode', p.reviewMode, [['all', 'Every idea I read'], ['saved', 'Only saved ideas']])}</div>
    <div class="set"><p class="line-title">Appearance</p>${seg('set-theme', S.state.settings.theme, [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']])}</div>
    <button type="button" class="set link-row" data-act="edit-areas"><span><span class="line-title">Areas and interests</span><span class="row-sub">${esc(p.topics.map(topicName).join(', '))}</span></span>${icon('next', { size: 18 })}</button>
  </div>

  <h2 class="sec">Your data</h2>
  <div class="group pad settings">
    <button type="button" class="set link-row" data-act="check-content"><span><span class="line-title">Check for new ideas</span><span class="row-sub">Library version ${C.contentVersion}, ${plural(C.builtInIds.length, 'idea')}</span></span>${icon('next', { size: 18 })}</button>
    <button type="button" class="set link-row" data-act="export"><span><span class="line-title">Back up your progress</span><span class="row-sub">Saves a file you can keep in Files or iCloud Drive.</span></span>${icon('next', { size: 18 })}</button>
    <button type="button" class="set link-row" data-act="import"><span><span class="line-title">Restore from a backup</span><span class="row-sub">Replaces everything on this device.</span></span>${icon('next', { size: 18 })}</button>
    ${!isStandalone() ? `<button type="button" class="set link-row" data-act="install-help"><span><span class="line-title">Add to Home Screen</span><span class="row-sub">Open full screen and offline.</span></span>${icon('next', { size: 18 })}</button>` : ''}
    <button type="button" class="set link-row danger" data-act="reset"><span><span class="line-title">Erase everything</span><span class="row-sub">Progress, stashes, journal and your own ideas.</span></span></button>
  </div>
  <p class="note center">Kaizen ${S.APP_VERSION}. Your data stays on this device.</p>
  <input type="file" accept="application/json,.json" data-import hidden>`;
}

function heatmap() {
  const weeks = 16;
  const t = dayKey();
  const dow = (parseDay(t).getDay() + 6) % 7; // Monday = 0
  const start = addDays(t, -dow - (weeks - 1) * 7);
  const g = S.goal();
  let cells = '';
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const k = addDays(start, w * 7 + d);
      if (k > t) { cells += '<i class="hm f"></i>'; continue; }
      const rec = S.state.days[k];
      const n = rec?.ids.length || 0;
      const lvl = rec?.met ? 3 : n >= g / 2 ? 2 : n > 0 ? 1 : 0;
      cells += `<i class="hm l${lvl}" title="${k}: ${n}"></i>`;
    }
  }
  return `<div class="heat" role="img" aria-label="Reading activity for the last ${weeks} weeks">${cells}</div>
  <div class="heat-key"><span>Less</span><i class="hm l0"></i><i class="hm l1"></i><i class="hm l2"></i><i class="hm l3"></i><span>Goal met</span></div>`;
}

export function areasSheetHTML() {
  const p = S.state.profile;
  return `<h2 class="sheet-title">Areas and interests</h2>
  <form data-form>
    <ul class="choice-list compact">${C.topics.map((t) => `<li><label class="choice"><input type="checkbox" name="topic" value="${t.id}" ${p.topics.includes(t.id) ? 'checked' : ''}>
      ${tile('choice-' + t.id, t.id)}<span class="row-main"><span class="row-title">${esc(t.name)}</span></span><span class="tick">${icon('check', { size: 18 })}</span></label></li>`).join('')}</ul>
    <p class="sheet-text">Show more of</p>
    <div class="chips">${Object.entries(C.focus).map(([k, v]) => `<label class="chip"><input type="checkbox" name="focus" value="${k}" ${p.focus.includes(k) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div>
    <div class="sheet-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn btn-quiet" data-close type="button">Cancel</button></div>
  </form>`;
}

export function installSheetHTML() {
  return `<h2 class="sheet-title">Add to Home Screen</h2>
  <ol class="steps">
    <li><span class="step-n">1</span><span>Open this page in Safari.</span></li>
    <li><span class="step-n">2</span><span>Tap the Share button ${icon('share', { size: 18 })}.</span></li>
    <li><span class="step-n">3</span><span>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</span></li>
  </ol>
  <p class="sheet-text">The Home Screen app keeps its own copy of your progress. To move progress from Safari, back it up here first, then restore it inside the app.</p>
  <div class="sheet-actions"><button class="btn btn-primary" data-close type="button">Got it</button></div>`;
}

export function notFound() {
  return `${header('Not found', { back: '#/today' })}<div class="empty"><p class="line-title">This page doesn't exist anymore.</p><p class="row-sub">It may have been removed in a content update.</p></div>`;
}

export function loading(msg = 'Loading your ideas…') {
  return `<div class="loading"><p class="ob-title sm">Kaizen</p><p class="row-sub">${esc(msg)}</p></div>`;
}
