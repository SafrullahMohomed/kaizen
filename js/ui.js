// Shared UI primitives: toast, bottom sheet, confirm.
import { esc } from './util.js';

const $ = (sel, root = document) => root.querySelector(sel);

let toastTimer;
export function toast(msg, { action, onAction, ms = 3200 } = {}) {
  const root = $('#toast-root');
  clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast" role="status">${esc(msg)}${action ? `<button class="toast-btn" type="button">${esc(action)}</button>` : ''}</div>`;
  const el = root.firstElementChild;
  requestAnimationFrame(() => el.classList.add('in'));
  if (action) el.querySelector('button').addEventListener('click', () => { hideToast(); onAction?.(); });
  toastTimer = setTimeout(hideToast, ms);
}
export function hideToast() {
  const el = $('#toast-root .toast');
  if (!el) return;
  el.classList.remove('in');
  setTimeout(() => el.remove(), 250);
}

let sheetClose = null;
/**
 * Open a bottom sheet. `render(el)` fills it and wires events.
 * Returns a close function. Only one sheet at a time.
 */
export function sheet(html, { onOpen, onClose, label = 'Dialog' } = {}) {
  closeSheet();
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="sheet-grip"></div>${html}</div>`;
  const back = root.querySelector('.sheet-backdrop');
  const el = root.querySelector('.sheet');
  requestAnimationFrame(() => root.classList.add('open'));
  const close = () => {
    if (sheetClose !== close) return;
    sheetClose = null;
    root.classList.remove('open');
    setTimeout(() => { if (!sheetClose) root.innerHTML = ''; }, 260);
    onClose?.();
  };
  sheetClose = close;
  back.addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  onOpen?.(el, close);
  const first = el.querySelector('[autofocus]');
  if (first) setTimeout(() => first.focus(), 280);
  return close;
}
export function closeSheet() {
  sheetClose?.();
}
export const sheetOpen = () => !!sheetClose;

export function confirmSheet({ title, body = '', confirm = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    sheet(
      `<h2 class="sheet-title">${esc(title)}</h2>${body ? `<p class="sheet-text">${esc(body)}</p>` : ''}
       <div class="sheet-actions"><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${esc(confirm)}</button>
       <button class="btn btn-quiet" data-close type="button">Cancel</button></div>`,
      {
        label: title,
        onOpen: (el, close) => el.querySelector('[data-yes]').addEventListener('click', () => { answered = true; close(); resolve(true); }),
        onClose: () => { if (!answered) resolve(false); },
      }
    );
  });
}
