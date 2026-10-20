'use strict';
const $ = id => document.getElementById(id);
let book, all = [], current = 0, fontSize = 21, searchTimer, drawerTrigger;
const compact = window.matchMedia('(max-width: 1100px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const store = {
  get(k) { try { return localStorage.getItem('sira-reader-' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('sira-reader-' + k, v); } catch {} }
};
const norm = s => s.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').toLowerCase();
function setDrawer(open, restoreFocus = true) {
  const isOpen = compact.matches && open;
  const wasOpen = $('sidebar').classList.contains('open');
  if (isOpen && !wasOpen) drawerTrigger = document.activeElement;
  $('sidebar').classList.toggle('open', isOpen);
  document.body.classList.toggle('toc-open', isOpen);
  $('toc-toggle').setAttribute('aria-expanded', String(isOpen));
  $('sidebar-backdrop').hidden = !isOpen;
  $('sidebar').inert = compact.matches && !isOpen;
  $('main').inert = isOpen;
  document.querySelector('.topbar').inert = isOpen;
  if (isOpen) {
    $('sidebar').setAttribute('role', 'dialog');
    $('sidebar').setAttribute('aria-modal', 'true');
    $('search').focus({ preventScroll: true });
  } else {
    $('sidebar').removeAttribute('role');
    $('sidebar').removeAttribute('aria-modal');
    if (wasOpen && restoreFocus && drawerTrigger?.isConnected) drawerTrigger.focus({ preventScroll: true });
  }
}
compact.addEventListener('change', () => setDrawer(false));
$('toc-toggle').onclick = () => setDrawer(!$('sidebar').classList.contains('open'));
$('toc-close').onclick = () => setDrawer(false);
$('sidebar-backdrop').onclick = () => setDrawer(false);
$('browse-book').onclick = () => {
  if (compact.matches) setDrawer(true);
  else { $('sidebar').scrollTop = 0; $('search').focus(); }
};
document.addEventListener('keydown', e => {
  if (!$('sidebar').classList.contains('open')) return;
  if (e.key === 'Escape') { e.preventDefault(); setDrawer(false); }
  if (e.key === 'Tab') {
    const focusable = [...$('sidebar').querySelectorAll('button:not(:disabled),input,a[href],[tabindex="0"]')].filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
setDrawer(false, false);
function toc(query = '') {
  const q = norm(query.trim());
  const list = q ? all.filter(e => e.normal.includes(q)) : all;
  const frag = document.createDocumentFragment();
  let section = '';
  for (const e of list) {
    if (e.section !== section) {
      section = e.section;
      const h = document.createElement('h3'); h.textContent = section; frag.append(h);
    }
    const b = document.createElement('button');
    b.textContent = e.title; b.dataset.id = e.id;
    b.classList.toggle('active', all[current]?.id === e.id);
    if (all[current]?.id === e.id) b.setAttribute('aria-current', 'page');
    b.onclick = () => openPage(all.indexOf(e), true);
    frag.append(b);
  }
  $('toc').replaceChildren(frag);
  $('results').textContent = q ? `${list.length} نتيجة في الكتاب` : `${all.length} موضوعًا · فهرس الكتاب الكامل`;
  if (!list.length) { const p = document.createElement('p'); p.textContent = 'لا توجد نتائج. جرّب كلمة أخرى.'; $('toc').append(p); }
}
function scrollToReader() {
  $('article').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  $('article').focus({ preventScroll: true });
}
function openPage(index, scroll = false) {
  if (!all[index]) return;
  current = index;
  const e = all[index];
  $('title').textContent = e.title; $('section').textContent = e.section;
  $('position').textContent = 'السيرة النبوية · ' + e.section;
  $('content').innerHTML = e.html;
  $('progress').textContent = `${index + 1} / ${all.length}`;
  $('prev').disabled = index === 0; $('next').disabled = index === all.length - 1;
  $('article').setAttribute('aria-busy', 'false');
  $('start-reading').disabled = false;
  document.title = e.title + ' | السيرة النبوية';
  store.set('page', e.id);
  history.replaceState(null, '', '#' + encodeURIComponent(e.id));
  document.querySelectorAll('#toc button').forEach(b => {
    b.classList.toggle('active', b.dataset.id === e.id);
    if (b.dataset.id === e.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  setDrawer(false, !scroll);
  if (scroll) scrollToReader();
}
function showBio(target) {
  const a = target.closest('[data-link-id]');
  if (!a || !book) return;
  const bio = book.tarajim[a.dataset.linkId];
  if (!bio) {
    $('toast').textContent = 'لا توجد ترجمة مرفقة لهذا الاسم.'; $('toast').style.display = 'block';
    setTimeout(() => $('toast').style.display = 'none', 2200); return;
  }
  $('bio-title').textContent = bio.title;
  $('bio-content').innerHTML = bio.html;
  if (bio.image && /^data:image\/(png|jpeg|gif|webp);base64,/.test(bio.image)) {
    const img = document.createElement('img'); img.src = bio.image; img.alt = bio.title;
    img.style.cssText = 'display:block;max-width:100%;height:auto;border-radius:8px;margin:0 auto 20px';
    $('bio-content').prepend(img);
  }
  $('bio').showModal();
}
$('content').addEventListener('click', e => { if (e.target.closest('[data-link-id]')) { e.preventDefault(); showBio(e.target); } });
$('content').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-link-id]')) { e.preventDefault(); showBio(e.target); } });
$('close-bio').onclick = () => $('bio').close();
$('bio').onclick = e => { if (e.target === $('bio')) { const r = $('bio').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('bio').close(); } };
$('prev').onclick = () => openPage(current - 1, true);
$('next').onclick = () => openPage(current + 1, true);
$('start-reading').onclick = scrollToReader;
$('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => toc($('search').value), 180); });
function theme(dark) {
  document.body.classList.toggle('dark', dark);
  $('theme').textContent = dark ? 'الوضع النهاري' : 'الوضع الليلي';
  $('theme').setAttribute('aria-pressed', String(dark));
  store.set('theme', dark ? 'dark' : 'light');
}
$('theme').onclick = () => theme(!document.body.classList.contains('dark'));
theme(store.get('theme') === 'dark');
function font(n) {
  fontSize = Math.max(16, Math.min(34, n));
  document.documentElement.style.setProperty('--font', fontSize + 'px');
  $('smaller').disabled = fontSize <= 16; $('larger').disabled = fontSize >= 34;
  store.set('font', String(fontSize));
}
font(Number(store.get('font')) || 21);
$('smaller').onclick = () => font(fontSize - 2);
$('larger').onclick = () => font(fontSize + 2);
fetch('book.json').then(r => { if (!r.ok) throw Error('load'); return r.json(); }).then(async manifest => {
  const load = async url => { const r = await fetch(url); if (!r.ok) throw Error('load'); return r.json(); };
  const parts = await Promise.all(manifest.parts.map(load));
  return { entries: parts.flat(), tarajim: await load(manifest.biographies) };
}).then(data => {
  book = data;
  all = data.entries.map(e => ({ ...e, normal: norm(e.title + ' ' + e.section + ' ' + e.text) }));
  $('page-count').textContent = all.length + ' موضوعًا';
  let hash = ''; try { hash = decodeURIComponent(location.hash.slice(1)); } catch {}
  const remembered = hash || store.get('page');
  const index = all.findIndex(e => e.id === remembered);
  openPage(index < 0 ? 0 : index); toc();
}).catch(() => {
  $('article').setAttribute('aria-busy', 'false');
  $('title').textContent = 'تعذّر تحميل الكتاب';
  $('content').textContent = 'يرجى التحقق من الاتصال بالإنترنت وتحديث الصفحة.';
  $('results').textContent = 'تعذّر التحميل'; $('prev').disabled = true; $('next').disabled = true;
});
