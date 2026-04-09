// ── Audience filter ──────────────────────────────────────────────────────────
let currentAud = 'all';

function setAud(aud) {
  currentAud = aud;
  document.querySelectorAll('.aud-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.aud-btn[data-aud="${aud}"]`).forEach(b => b.classList.add('active'));
}

document.querySelectorAll('.aud-btn').forEach(btn => {
  btn.addEventListener('click', () => setAud(btn.dataset.aud));
});

// ── Accordion ────────────────────────────────────────────────────────────────
function toggleCard(btn) {
  btn.closest('.article-card').classList.toggle('open');
}

// ── Sub-nav tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll('.sub-nav').forEach(nav => {
  const tabs = nav.querySelectorAll('.sub-tab');
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const section = nav.closest('.view-content') || document;
      const cards = section.querySelectorAll('.article-card');
      cards.forEach(c => {
        c.style.display = (i === 1 && c.dataset.updated !== 'true') ? 'none' : '';
      });
    });
  });
});

// ── Search ───────────────────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const searchClear   = document.getElementById('searchClear');
const resultBadge   = document.getElementById('resultBadge');
const searchResults = document.getElementById('searchResults');
const searchList    = document.getElementById('searchList');
const searchHeader  = document.getElementById('searchHeader');

// articles injected by the page as window.__ARTICLES__
function doSearch() {
  const q = searchInput.value.trim().toLowerCase();
  searchClear.style.display = q ? 'block' : 'none';
  if (!q) {
    searchResults.style.display = 'none';
    resultBadge.style.display   = 'none';
    return;
  }
  const articles = window.__ARTICLES__ || [];
  const matches  = articles.filter(a =>
    (a.q + ' ' + a.body + ' ' + a.topic).toLowerCase().indexOf(q) !== -1
  );
  resultBadge.textContent     = matches.length + (matches.length === 1 ? ' result' : ' results');
  resultBadge.style.display   = 'block';
  searchHeader.innerHTML = '<strong>' + matches.length + ' result' +
    (matches.length !== 1 ? 's' : '') + '</strong> for &ldquo;' + escH(searchInput.value.trim()) + '&rdquo;';
  searchList.innerHTML = '';
  matches.forEach(a => {
    const card = document.createElement('div');
    card.className = 'sr-card' + (a.updated ? ' has-upd' : '');
    card.innerHTML =
      '<div class="src-topic">' + escH(a.topic) + (a.updated ? ' &nbsp;&#9733; Updated 2025' : '') + ' &rsaquo;</div>' +
      '<div class="src-title">'   + hlT(escH(a.q),    q) + '</div>' +
      '<div class="src-excerpt">' + hlT(escH(a.body),  q) + '</div>';
    card.addEventListener('click', () => { window.location.href = a.href; });
    searchList.appendChild(card);
  });
  searchResults.style.display = 'block';
}

searchInput?.addEventListener('input', doSearch);
searchClear?.addEventListener('click', () => {
  searchInput.value = '';
  doSearch();
  searchInput.focus();
});

function escH(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function hlT(s, q) {
  const i = s.toLowerCase().indexOf(q);
  if (i === -1) return s;
  return s.slice(0,i) + '<mark>' + s.slice(i, i+q.length) + '</mark>' + s.slice(i+q.length);
}

// ── Subscribe modal open/close ───────────────────────────────────────────────
function openSubscribe() {
  document.getElementById('subscribeModal').classList.add('open');
}
function closeSubscribe() {
  document.getElementById('subscribeModal').classList.remove('open');
  setTimeout(() => {
    const wrap = document.getElementById('subscribeFormWrap');
    const succ = document.getElementById('subscribeSuccess');
    if (wrap) wrap.style.display = 'block';
    if (succ) succ.style.display = 'none';
  }, 300);
}
function closeSubscribeOnBg(e) {
  if (e.target === document.getElementById('subscribeModal')) closeSubscribe();
}
// submitSubscribe and toggleTopic / selectFreq are now handled
// inside SubscribeModal.astro to keep form logic co-located with the form.
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSubscribe(); });
