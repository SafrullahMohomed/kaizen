// Full-screen reader: one idea per page, swipe up for the next.
import { esc, paras, plural, numWord, cap } from './util.js';
import { art, icon } from './art.js';
import { C, idea as getIdea, sourceLine } from './content.js';
import * as S from './store.js';
import { toast } from './ui.js';
import { stashSheet, reflectSheet } from './sheets.js';

let current = null;

const topicName = (t) => C.topicById.get(t)?.name || '';

function pageHTML(i, n, total) {
  const isNew = S.isNew(i.id);
  return `<section class="page t-${i.topic}" data-id="${esc(i.id)}" data-idx="${n}" aria-label="Idea ${n + 1} of ${total}">
    <div class="page-art">${art(i.id, i.topic)}</div>
    <div class="page-meta"><span>${esc(topicName(i.topic))}</span>${isNew ? '<span class="tag-new">New</span>' : ''}${S.isRead(i.id) ? '<span class="page-read">Read</span>' : ''}</div>
    <h2 class="page-title">${esc(i.title)}</h2>
    <div class="page-body">${paras(i.body)}</div>
    <p class="page-source">${esc(sourceLine(i))}</p>
  </section>`;
}

function endHTML(ctx) {
  if (ctx.kind !== 'today') {
    return `<section class="page page-end" data-end="1">
      <h2 class="end-title">That's the end of ${esc(ctx.label)}.</h2>
      <p class="end-text">Ideas you read come back in Review at growing intervals, so they stick.</p>
      <div class="end-actions"><button class="btn btn-light" data-r="close" type="button">Done</button></div>
    </section>`;
  }
  const done = S.readToday();
  const g = S.goal();
  const left = Math.max(0, g - done);
  const due = S.dueIds().length;
  const streak = S.streak();
  return `<section class="page page-end" data-end="1">
    ${left === 0
      ? `<h2 class="end-title">Daily goal done.</h2><p class="end-text">${streak > 1 ? `That's ${numWord(streak)} days in a row. ` : ''}Keep going, or let today's ideas settle.</p>`
      : `<h2 class="end-title">${cap(numWord(left))} more to reach today's goal.</h2><p class="end-text">You've read ${plural(done, 'idea')} today.</p>`}
    <div class="end-actions">
      <button class="btn btn-light" data-r="more" type="button">Read ${numWord(g)} more ideas</button>
      ${due ? `<button class="btn btn-ghost-light" data-r="review" type="button">Review ${plural(due, 'card')}</button>` : ''}
      <button class="btn btn-ghost-light" data-r="close" type="button">Done</button>
    </div>
  </section>`;
}

function barHTML() {
  return `<div class="r-bar" role="toolbar" aria-label="Idea actions">
    <button type="button" class="r-act" data-r="save" aria-label="Save">${icon('save')}<span>Save</span></button>
    <button type="button" class="r-act" data-r="try" aria-label="Try it today">${icon('try')}<span>Try it</span></button>
    <button type="button" class="r-act" data-r="reflect" aria-label="Reflect">${icon('reflect')}<span>Reflect</span></button>
    <button type="button" class="r-act" data-r="listen" aria-label="Listen">${icon('listen')}<span>Listen</span></button>
    <button type="button" class="r-act" data-r="share" aria-label="Share">${icon('share')}<span>Share</span></button>
  </div>`;
}

/**
 * ctx: { kind: 'today' | 'list', label }
 * hooks: { onClose(), onMore(), onReview() }
 */
export function openReader(ids, { start = 0, ctx = { kind: 'list', label: 'this list' }, onClose, onMore, onReview } = {}) {
  closeReader(true);
  ids = ids.filter((id) => C.ideas.has(id));
  if (!ids.length) return;
  const root = document.getElementById('overlay-root');
  const items = ids.map(getIdea);
  root.insertAdjacentHTML('beforeend', `<div class="reader" data-topic="${items[start]?.topic || items[0].topic}">
    <div class="r-top">
      <button type="button" class="r-close" data-r="close" aria-label="Close reader">${icon('close')}</button>
      <div class="r-progress" aria-live="polite"></div>
    </div>
    <div class="r-pages">${items.map((i, n) => pageHTML(i, n, items.length)).join('')}${endHTML(ctx)}</div>
    ${barHTML()}
  </div>`);
  document.documentElement.classList.add('locked');
  const el = root.lastElementChild;
  const pages = el.querySelector('.r-pages');
  const state = { ids, idx: start, el, timers: new Map(), ctx, onClose, onMore, onReview, speaking: false };
  current = state;

  const progress = el.querySelector('.r-progress');
  const setIdx = (n) => {
    if (state.idx !== n) stopSpeaking();
    state.idx = n;
    const atEnd = n >= ids.length;
    el.classList.toggle('at-end', atEnd);
    el.dataset.topic = atEnd ? 'end' : items[n].topic;
    progress.textContent = atEnd ? '' : `${n + 1} of ${ids.length}`;
    syncBar();
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const p = e.target;
        const n = p.dataset.end ? ids.length : Number(p.dataset.idx);
        if (e.intersectionRatio >= 0.55) {
          setIdx(n);
          if (!p.dataset.end && !state.timers.has(n)) {
            state.timers.set(n, setTimeout(() => {
              if (S.markRead(ids[n])) {
                const tag = p.querySelector('.page-meta');
                if (tag && !tag.querySelector('.page-read')) tag.insertAdjacentHTML('beforeend', '<span class="page-read">Read</span>');
                p.querySelector('.tag-new')?.remove();
                if (ctx.kind === 'today') refreshEnd();
              }
            }, 1600));
          }
        } else if (state.timers.has(n)) {
          clearTimeout(state.timers.get(n));
          state.timers.delete(n);
        }
      }
    },
    { root: pages, threshold: [0, 0.55, 1] }
  );
  state.io = io;
  pages.querySelectorAll('.page').forEach((p) => io.observe(p));

  function refreshEnd() {
    const end = pages.querySelector('[data-end]');
    end.outerHTML = endHTML(ctx);
    io.observe(pages.querySelector('[data-end]'));
  }

  function syncBar() {
    const id = ids[state.idx];
    if (!id) return;
    const i = getIdea(id);
    el.querySelector('[data-r="save"]').innerHTML = `${icon('save', { filled: S.isSaved(id) })}<span>${S.isSaved(id) ? 'Saved' : 'Save'}</span>`;
    const hasAction = S.state.actions.some((a) => a.ideaId === id && !a.done);
    const tryBtn = el.querySelector('[data-r="try"]');
    tryBtn.disabled = !i.action;
    tryBtn.classList.toggle('on', hasAction);
    tryBtn.querySelector('span').textContent = hasAction ? 'Added' : 'Try it';
    el.querySelector('[data-r="listen"]').innerHTML = `${icon(state.speaking ? 'stop' : 'listen')}<span>${state.speaking ? 'Stop' : 'Listen'}</span>`;
  }
  state.syncBar = syncBar;

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    const id = ids[state.idx];
    const i = getIdea(id);
    switch (b.dataset.r) {
      case 'close':
        return closeReader();
      case 'more':
        closeReader(true);
        return onMore?.();
      case 'review':
        closeReader(true);
        return onReview?.();
      case 'save':
        if (!S.isSaved(id)) {
          S.setInStash('saved', id, true);
          syncBar();
          toast('Saved', { action: 'Add to stash', onAction: () => stashSheet(id, { onDone: syncBar }) });
        } else {
          stashSheet(id, { onDone: syncBar });
        }
        return;
      case 'try': {
        if (!i.action) return;
        const had = S.state.actions.some((a) => a.ideaId === id && !a.done);
        S.addAction(id, i.action);
        syncBar();
        toast(had ? 'Already in today’s actions' : 'Added to today’s actions');
        return;
      }
      case 'reflect':
        return reflectSheet(id);
      case 'listen':
        return state.speaking ? stopSpeaking() : speak(i);
      case 'share':
        return share(i);
    }
  });

  const onKey = (e) => {
    if (e.key === 'Escape') closeReader();
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); scrollToIdx(state.idx + 1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); scrollToIdx(state.idx - 1); }
  };
  document.addEventListener('keydown', onKey);
  state.onKey = onKey;

  function scrollToIdx(n) {
    const all = pages.querySelectorAll('.page');
    const t = all[Math.max(0, Math.min(all.length - 1, n))];
    t?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setIdx(start);
  if (start) requestAnimationFrame(() => {
    pages.querySelectorAll('.page')[start].scrollIntoView({ block: 'start' });
  });
  requestAnimationFrame(() => el.classList.add('in'));
  el.querySelector('.r-close').focus({ preventScroll: true });
}

function speak(i) {
  if (!('speechSynthesis' in window)) return toast('Listening isn’t supported on this device');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(`${i.title}. ${i.body.replace(/\n+/g, ' ')}`);
  u.lang = 'en-US';
  u.rate = 1;
  u.onend = u.onerror = () => { if (current) { current.speaking = false; current.syncBar(); } };
  speechSynthesis.speak(u);
  current.speaking = true;
  current.syncBar();
}
function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (current?.speaking) { current.speaking = false; current.syncBar?.(); }
}

async function share(i) {
  const text = `${i.title}\n\n${i.body}\n\n${sourceLine(i)}`;
  try {
    if (navigator.share) return await navigator.share({ title: i.title, text });
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard');
  } catch (e) {
    if (e?.name !== 'AbortError') toast('Couldn’t share this idea');
  }
}

export function closeReader(silent = false) {
  if (!current) return;
  const c = current;
  current = null;
  stopSpeaking();
  c.io?.disconnect();
  c.timers.forEach(clearTimeout);
  document.removeEventListener('keydown', c.onKey);
  c.el.classList.remove('in');
  document.documentElement.classList.remove('locked');
  setTimeout(() => c.el.remove(), 220);
  S.commit();
  if (!silent) c.onClose?.();
}

export const readerOpen = () => !!current;
