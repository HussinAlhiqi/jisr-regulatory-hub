// ── Audience filter ───────────────────────────────────────────────────────────
let currentAud = 'all';

function setAud(aud) {
  currentAud = aud;
  document.querySelectorAll('.aud-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.aud-btn[data-aud="${aud}"]`).forEach(b => b.classList.add('active'));
  applyAudienceFilter();
}

function applyAudienceFilter() {
  const cards = document.querySelectorAll('.article-card');
  if (!cards.length) return;
  let visible = 0;
  cards.forEach(card => {
    if (currentAud === 'all') {
      card.style.display = '';
      visible++;
    } else {
      const audiences = (card.dataset.audiences || 'all').split(',');
      const show = audiences.includes(currentAud) || audiences.includes('all');
      card.style.display = show ? '' : 'none';
      if (show) visible++;
    }
  });
  // Show/hide the audience-filter banner
  let banner = document.getElementById('aud-filter-banner');
  if (currentAud !== 'all') {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'aud-filter-banner';
      banner.className = 'aud-filter-banner';
      const col = document.querySelector('.articles-col');
      if (col) col.insertBefore(banner, col.firstChild);
    }
    const label = document.querySelector(`.aud-btn[data-aud="${currentAud}"]`)?.textContent || currentAud;
    banner.innerHTML = `Showing ${visible} article${visible !== 1 ? 's' : ''} for <strong>${label}</strong>. <a href="#" onclick="setAud('all');return false;">Show all</a>`;
    banner.style.display = '';
  } else if (banner) {
    banner.style.display = 'none';
  }
}

document.querySelectorAll('.aud-btn').forEach(btn => {
  btn.addEventListener('click', () => setAud(btn.dataset.aud));
});

// ── Accordion ─────────────────────────────────────────────────────────────────
function toggleCard(btn) {
  btn.closest('.article-card').classList.toggle('open');
}

// ── Sub-nav tabs ──────────────────────────────────────────────────────────────
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

// ── Search ────────────────────────────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const searchClear   = document.getElementById('searchClear');
const resultBadge   = document.getElementById('resultBadge');
const searchResults = document.getElementById('searchResults');
const searchList    = document.getElementById('searchList');
const searchHeader  = document.getElementById('searchHeader');

// Popular search suggestions shown on zero results
const POPULAR = ['probation','maternity leave','overtime','end of service','Nitaqat','GOSI','Mudad','Saudization','paternity','annual leave','health insurance','outdoor ban'];

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
  resultBadge.textContent   = matches.length + (matches.length === 1 ? ' result' : ' results');
  resultBadge.style.display = 'block';
  searchHeader.innerHTML    = '<strong>' + matches.length + ' result' +
    (matches.length !== 1 ? 's' : '') + '</strong> for &ldquo;' + escH(searchInput.value.trim()) + '&rdquo;';
  searchList.innerHTML = '';

  if (matches.length === 0) {
    // ── Empty state ──
    const empty = document.createElement('div');
    empty.className = 'sr-empty';
    empty.innerHTML = `
      <div class="sr-empty-msg">No articles found for <strong>"${escH(searchInput.value.trim())}"</strong></div>
      <div class="sr-empty-hint">Try searching for:</div>
      <div class="sr-chips">${POPULAR.map(s =>
        `<button class="sr-chip" onclick="document.getElementById('searchInput').value='${s}';doSearch()">${s}</button>`
      ).join('')}</div>`;
    searchList.appendChild(empty);
  } else {
    matches.forEach(a => {
      const card = document.createElement('div');
      card.className = 'sr-card' + (a.updated ? ' has-upd' : '');
      card.innerHTML =
        '<div class="src-topic">' + escH(a.topic) + (a.updated ? ' &nbsp;&#9733; Updated 2025' : '') + ' &rsaquo;</div>' +
        '<div class="src-title">'   + hlT(escH(a.q),   q) + '</div>' +
        '<div class="src-excerpt">' + hlT(escH(a.body), q) + '</div>';
      card.addEventListener('click', () => {
        searchResults.style.display = 'none';
        searchInput.value = '';
        resultBadge.style.display = 'none';
        // Navigate and then open + scroll to the specific card
        if (window.location.pathname.replace(/\/$/, '') === a.href.replace(/#.*/, '').replace(/\/$/, '')) {
          // Already on this topic page — just open and scroll
          openAndScrollToArticle(a.articleId);
        } else {
          window.location.href = a.href;
        }
      });
      searchList.appendChild(card);
    });
  }
  searchResults.style.display = 'block';
}

function openAndScrollToArticle(articleId) {
  if (!articleId) return;
  const target = document.getElementById(articleId);
  if (!target) return;
  target.classList.add('open');
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// On page load, check for a hash and open + scroll to that article
window.addEventListener('DOMContentLoaded', () => {
  if (location.hash) {
    const id = location.hash.slice(1);
    setTimeout(() => openAndScrollToArticle(id), 80);
  }
});

searchInput?.addEventListener('input', doSearch);
searchClear?.addEventListener('click', () => {
  searchInput.value = '';
  doSearch();
  searchInput.focus();
});

// Close search results when clicking outside
document.addEventListener('click', e => {
  if (searchResults && !searchResults.contains(e.target) && e.target !== searchInput) {
    searchResults.style.display = 'none';
  }
});

function escH(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function hlT(s, q) {
  const i = s.toLowerCase().indexOf(q);
  if (i === -1) return s;
  return s.slice(0,i) + '<mark>' + s.slice(i, i+q.length) + '</mark>' + s.slice(i+q.length);
}

// ── Subscribe modal open/close ─────────────────────────────────────────────────
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSubscribe(); });

// ── Back to top ───────────────────────────────────────────────────────────────
(function() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();
