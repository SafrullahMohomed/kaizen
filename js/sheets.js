// Bottom sheets used from several screens.
import { esc } from './util.js';
import { sheet, toast } from './ui.js';
import { icon } from './art.js';
import { C, idea as getIdea } from './content.js';
import * as S from './store.js';

export function stashSheet(ideaId, { onDone } = {}) {
  const render = () => {
    const mine = S.stashesFor(ideaId);
    return S.state.stashes
      .map(
        (s) => `<button type="button" class="pick-row" data-stash="${esc(s.id)}" aria-pressed="${mine.includes(s.id)}">
          <span class="pick-name">${esc(s.name)}</span><span class="pick-count">${s.ideas.length}</span>
          <span class="pick-check">${mine.includes(s.id) ? icon('check', { size: 20 }) : ''}</span></button>`
      )
      .join('');
  };
  sheet(
    `<h2 class="sheet-title">Save to a stash</h2>
     <p class="sheet-text">${esc(getIdea(ideaId)?.title || '')}</p>
     <div class="pick-list" data-list>${render()}</div>
     <form class="inline-form" data-new>
       <input class="field" name="name" placeholder="New stash, e.g. Team 1:1s" maxlength="40" aria-label="New stash name" autocomplete="off">
       <button class="btn btn-secondary" type="submit">Create</button>
     </form>
     <div class="sheet-actions"><button class="btn btn-primary" data-close type="button">Done</button></div>`,
    {
      label: 'Save to a stash',
      onClose: onDone,
      onOpen: (el) => {
        const list = el.querySelector('[data-list]');
        list.addEventListener('click', (e) => {
          const b = e.target.closest('[data-stash]');
          if (!b) return;
          const on = b.getAttribute('aria-pressed') !== 'true';
          S.setInStash(b.dataset.stash, ideaId, on);
          list.innerHTML = render();
        });
        el.querySelector('[data-new]').addEventListener('submit', (e) => {
          e.preventDefault();
          const input = e.target.elements.name;
          if (!input.value.trim()) return input.focus();
          const s = S.createStash(input.value);
          S.setInStash(s.id, ideaId, true);
          input.value = '';
          list.innerHTML = render();
        });
      },
    }
  );
}

const PROMPTS = [
  'Where could you use this at work this week?',
  'When did you last see this play out, for better or worse?',
  'What would change if your team took this seriously?',
  'What is one thing you would do differently because of this?',
];

export function reflectSheet(ideaId, { onDone } = {}) {
  const i = getIdea(ideaId);
  const prompt = PROMPTS[(ideaId || '').length % PROMPTS.length];
  sheet(
    `<h2 class="sheet-title">Reflect</h2>
     <p class="sheet-text">${esc(prompt)}</p>
     <form data-form>
       <textarea class="field area" name="text" rows="5" placeholder="Write a few lines…" autofocus aria-label="Your reflection"></textarea>
       <div class="sheet-actions"><button class="btn btn-primary" type="submit">Save reflection</button>
       <button class="btn btn-quiet" data-close type="button">Cancel</button></div>
     </form>
     ${i ? `<p class="sheet-foot">On “${esc(i.title)}”</p>` : ''}`,
    {
      label: 'Reflect',
      onClose: onDone,
      onOpen: (el, close) => {
        el.querySelector('[data-form]').addEventListener('submit', (e) => {
          e.preventDefault();
          const text = e.target.elements.text.value.trim();
          if (!text) return e.target.elements.text.focus();
          S.addJournal({ ideaId, text, kind: 'reflection' });
          close();
          toast('Reflection saved to your journal');
        });
      },
    }
  );
}

export function actionDoneSheet(actionId, { onDone } = {}) {
  const a = S.state.actions.find((x) => x.id === actionId);
  if (!a) return;
  sheet(
    `<h2 class="sheet-title">Nice work</h2>
     <p class="sheet-text">${esc(a.text)}</p>
     <form data-form>
       <textarea class="field area" name="note" rows="4" placeholder="How did it go? (optional)" aria-label="How did it go?"></textarea>
       <div class="sheet-actions"><button class="btn btn-primary" type="submit">Mark as done</button>
       <button class="btn btn-quiet" data-close type="button">Not yet</button></div>
     </form>`,
    {
      label: 'Complete action',
      onClose: onDone,
      onOpen: (el, close) => {
        el.querySelector('[data-form]').addEventListener('submit', (e) => {
          e.preventDefault();
          S.completeAction(actionId, e.target.elements.note.value);
          close();
          toast('Action done');
        });
      },
    }
  );
}

export function ideaEditorSheet(existing = null, { onDone } = {}) {
  const u = existing || { title: '', body: '', sourceTitle: '', author: '', topic: S.state.profile.topics[0] || 'leadership', action: '', q: '', a: '' };
  const topics = C.topics.map((t) => `<option value="${t.id}" ${t.id === u.topic ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
  sheet(
    `<h2 class="sheet-title">${existing ? 'Edit your idea' : 'Write an idea'}</h2>
     <form data-form class="stack">
       <label class="lbl">Title<input class="field" name="title" required maxlength="80" value="${esc(u.title)}" placeholder="A short, memorable headline"></label>
       <label class="lbl">The idea<textarea class="field area" name="body" required rows="5" maxlength="900" placeholder="Explain it in your own words, in under 100 words.">${esc(u.body)}</textarea></label>
       <div class="two">
         <label class="lbl">Source<input class="field" name="sourceTitle" maxlength="80" value="${esc(u.sourceTitle)}" placeholder="Book, talk, article"></label>
         <label class="lbl">Author<input class="field" name="author" maxlength="60" value="${esc(u.author)}" placeholder="Optional"></label>
       </div>
       <label class="lbl">Area<select class="field" name="topic">${topics}</select></label>
       <label class="lbl">Try this today<input class="field" name="action" maxlength="160" value="${esc(u.action)}" placeholder="One small action (optional)"></label>
       <label class="lbl">Review question<input class="field" name="q" maxlength="140" value="${esc(u.q)}" placeholder="Optional; the title is used if empty"></label>
       <label class="lbl">Answer<input class="field" name="a" maxlength="200" value="${esc(u.a)}" placeholder="Optional"></label>
       <div class="sheet-actions"><button class="btn btn-primary" type="submit">${existing ? 'Save changes' : 'Add idea'}</button>
       <button class="btn btn-quiet" data-close type="button">Cancel</button></div>
     </form>`,
    {
      label: 'Write an idea',
      onClose: onDone,
      onOpen: (el, close) => {
        el.querySelector('[data-form]').addEventListener('submit', (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.target).entries());
          if (!d.title.trim() || !d.body.trim()) return;
          const saved = S.saveUserIdea({ ...(existing ? { id: existing.id } : {}), ...d });
          if (!existing) S.addToReview(saved.id);
          S.commit();
          close();
          toast(existing ? 'Idea updated' : 'Idea added to your library');
        });
      },
    }
  );
}
