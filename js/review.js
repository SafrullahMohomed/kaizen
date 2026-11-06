// Review (spaced-repetition flashcards) and a quick multiple-choice quiz.
import { esc, paras, plural, shuffle, relDay } from './util.js';
import { icon } from './art.js';
import { C, idea as getIdea, sourceLine, distractors } from './content.js';
import * as S from './store.js';
import { nextInterval, label } from './srs.js';

let open = null;

const qa = (i) => ({
  q: i.q || `What is the idea behind “${i.title}”?`,
  a: i.a || i.body.split(/\n{2,}/)[0],
});

function mount(html, cls) {
  const root = document.getElementById('overlay-root');
  root.insertAdjacentHTML('beforeend', `<div class="study ${cls}" role="dialog" aria-modal="true">${html}</div>`);
  const el = root.lastElementChild;
  document.documentElement.classList.add('locked');
  requestAnimationFrame(() => el.classList.add('in'));
  return el;
}

function unmount(el, onClose) {
  el.classList.remove('in');
  document.documentElement.classList.remove('locked');
  setTimeout(() => el.remove(), 220);
  open = null;
  S.commit();
  onClose?.();
}

const topicName = (t) => C.topicById.get(t)?.name || '';

export function openReview({ ids = S.dueIds(), onClose } = {}) {
  ids = ids.filter((id) => C.ideas.has(id)).slice(0, 40);
  if (!ids.length) return;
  const queue = ids.slice();
  const again = new Set();
  let done = 0;
  let revealed = false;
  const el = mount(`<div class="s-top"><button type="button" class="r-close" data-s="close" aria-label="Close review">${icon('close')}</button>
    <div class="s-meter" aria-hidden="true"><i></i></div><span class="s-count"></span></div><div class="s-stage"></div>`, 'review');
  open = el;
  const stage = el.querySelector('.s-stage');
  const meter = el.querySelector('.s-meter i');
  const count = el.querySelector('.s-count');

  const render = () => {
    const total = done + queue.length;
    meter.style.width = `${total ? (done / total) * 100 : 100}%`;
    count.textContent = queue.length ? `${done + 1} of ${total}` : '';
    if (!queue.length) return finish();
    const id = queue[0];
    const i = getIdea(id);
    const { q, a } = qa(i);
    const card = S.state.srs[id] || { reps: 0, ivl: 0, ease: 2.5 };
    const grades = [
      [1, 'Again'],
      [2, 'Hard'],
      [3, 'Good'],
      [4, 'Easy'],
    ];
    stage.innerHTML = `<article class="flash t-${i.topic} ${revealed ? 'revealed' : ''}">
      <p class="flash-topic"><span class="dot"></span>${esc(topicName(i.topic))}</p>
      <h2 class="flash-q">${esc(q)}</h2>
      ${revealed
        ? `<p class="flash-a">${esc(a)}</p>
           <details class="flash-more"><summary>Read the full idea</summary><h3>${esc(i.title)}</h3>${paras(i.body)}<p class="flash-src">${esc(sourceLine(i))}</p></details>`
        : `<p class="flash-hint">Say or think your answer, then check it.</p>`}
    </article>
    <div class="s-actions">${revealed
      ? `<div class="grades">${grades.map(([g, n]) => `<button type="button" class="grade g${g}" data-g="${g}"><b>${n}</b><span>${label(nextInterval(card, g))}</span></button>`).join('')}</div>`
      : `<button type="button" class="btn btn-primary btn-wide" data-s="reveal">Show answer</button>`}</div>`;
  };

  const finish = () => {
    const next = S.nextDueSummary();
    stage.innerHTML = `<div class="s-done">
      <h2 class="end-title">Review done.</h2>
      <p class="end-text">You reviewed ${plural(done, 'card')}${again.size ? `, and ${plural(again.size, 'card')} will come back soon` : ''}.${next ? ` Next review: ${relDay(next).toLowerCase() === 'today' ? 'later today' : relDay(next)}.` : ''}</p>
      <p class="end-text muted">Each time you remember an idea, it waits longer before coming back. After about three weeks it counts as mastered.</p>
    </div>`;
    el.querySelector('.s-actions')?.remove();
    stage.insertAdjacentHTML('beforeend', `<div class="s-actions"><button type="button" class="btn btn-primary btn-wide" data-s="close">Done</button></div>`);
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s],[data-g]');
    if (!b) return;
    if (b.dataset.s === 'close') return unmount(el, onClose);
    if (b.dataset.s === 'reveal') { revealed = true; return render(); }
    if (b.dataset.g) {
      const g = Number(b.dataset.g);
      const id = queue.shift();
      S.grade(id, g);
      if (g === 1 && !again.has(id)) { again.add(id); queue.push(id); }
      done++;
      revealed = false;
      render();
    }
  });
  const onKey = (e) => {
    if (!document.body.contains(el)) return document.removeEventListener('keydown', onKey);
    if (e.key === 'Escape') unmount(el, onClose);
    if (e.key === ' ' && !revealed) { e.preventDefault(); revealed = true; render(); }
    if (revealed && ['1', '2', '3', '4'].includes(e.key)) el.querySelector(`[data-g="${e.key}"]`)?.click();
  };
  document.addEventListener('keydown', onKey);
  render();
}

export function openQuiz({ onClose, n = 5 } = {}) {
  const topics = S.state.profile.topics;
  let pool = Object.keys(S.state.read).filter((id) => C.ideas.has(id) && getIdea(id).a && topics.includes(getIdea(id).topic));
  if (pool.length < n) pool = [...C.ideas.values()].filter((i) => i.a && topics.includes(i.topic)).map((i) => i.id);
  const qs = shuffle(pool).slice(0, n).map((id) => {
    const i = getIdea(id);
    const opts = shuffle([i.a, ...distractors(id, 3)]);
    return { id, q: i.q, opts, correct: opts.indexOf(i.a) };
  });
  let k = 0;
  let score = 0;
  let answered = -1;
  const el = mount(`<div class="s-top"><button type="button" class="r-close" data-s="close" aria-label="Close quiz">${icon('close')}</button>
    <div class="s-meter" aria-hidden="true"><i></i></div><span class="s-count"></span></div><div class="s-stage"></div>`, 'quiz');
  open = el;
  const stage = el.querySelector('.s-stage');
  const meter = el.querySelector('.s-meter i');
  const count = el.querySelector('.s-count');

  const render = () => {
    meter.style.width = `${(k / qs.length) * 100}%`;
    if (k >= qs.length) {
      count.textContent = '';
      stage.innerHTML = `<div class="s-done"><h2 class="end-title">${score} of ${qs.length} correct.</h2>
        <p class="end-text">${score === qs.length ? 'Every one. These ideas are sticking.' : 'Ideas you missed are now due in Review, so they come back soon.'}</p></div>
        <div class="s-actions"><button type="button" class="btn btn-primary btn-wide" data-s="again">Another quiz</button>
        <button type="button" class="btn btn-quiet btn-wide" data-s="close">Done</button></div>`;
      return;
    }
    count.textContent = `${k + 1} of ${qs.length}`;
    const q = qs[k];
    const i = getIdea(q.id);
    stage.innerHTML = `<article class="flash t-${i.topic}">
      <p class="flash-topic"><span class="dot"></span>${esc(topicName(i.topic))}</p>
      <h2 class="flash-q">${esc(q.q)}</h2>
      <div class="opts" role="list">${q.opts
        .map((o, n) => {
          const cls = answered < 0 ? '' : n === q.correct ? 'right' : n === answered ? 'wrong' : 'dim';
          return `<button type="button" role="listitem" class="opt ${cls}" data-o="${n}" ${answered >= 0 ? 'disabled' : ''}>${esc(o)}</button>`;
        })
        .join('')}</div>
      ${answered >= 0 ? `<p class="flash-src">From “${esc(i.title)}”, ${esc(sourceLine(i))}</p>` : ''}
    </article>
    ${answered >= 0 ? `<div class="s-actions"><button type="button" class="btn btn-primary btn-wide" data-s="next">${k + 1 < qs.length ? 'Next question' : 'See score'}</button></div>` : ''}`;
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-s],[data-o]');
    if (!b) return;
    if (b.dataset.s === 'close') return unmount(el, onClose);
    if (b.dataset.s === 'again') { unmount(el); return openQuiz({ onClose, n }); }
    if (b.dataset.s === 'next') { k++; answered = -1; return render(); }
    if (b.dataset.o && answered < 0) {
      answered = Number(b.dataset.o);
      const q = qs[k];
      if (answered === q.correct) score++;
      else if (S.state.srs[q.id]) S.state.srs[q.id].due = S.today();
      else S.addToReview(q.id);
      render();
    }
  });
  render();
}

export const studyOpen = () => !!open;
