/* Leonida Trophy Guide — offline tracker for the 55 GTA VI PS5 trophies.
   No network at runtime: the only fetch is the app's own data/trophies.json.
   Progress lives in localStorage and can be exported to / imported from a file. */
'use strict';

const DATA_URL = 'data/trophies.json';
const STORAGE_KEY = 'gta6-trophy-guide-v1';
const KIND_LABELS = {
  story: 'Story', activity: 'Activity', collectible: 'Collectible',
  robbery: 'Robbery', exploration: 'Exploration', misc: 'Misc',
  completion: '100%', platinum: 'Platinum'
};

let trophies = [];
let roadmap = [];
let earned = new Set();
let spoilerOn = false;
let kindFilter = 'all';
let gradeFilter = 'all';
let earnedFilter = 'all';
let searchQuery = '';
let selectedId = null;
let currentView = 'tracker';

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------------- progress storage ---------------- */

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved.earned)) earned = new Set(saved.earned.filter((n) => Number.isInteger(n)));
    if (typeof saved.spoiler === 'boolean') spoilerOn = saved.spoiler;
  } catch (err) {
    console.warn('Saved progress could not be read; starting fresh.', err);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      earned: [...earned].sort((a, b) => a - b),
      spoiler: spoilerOn,
      savedAt: new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Progress could not be saved.', err);
  }
}

function exportProgress() {
  const payload = {
    app: 'Leonida Trophy Guide — GTA VI (PS5)',
    exportedAt: new Date().toISOString(),
    total: trophies.length,
    earned: [...earned].sort((a, b) => a - b)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'gta6-trophy-progress.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const ids = Array.isArray(data.earned) ? data.earned : data;
      if (!Array.isArray(ids)) throw new Error('No earned list found in the file.');
      const valid = new Set(trophies.map((t) => t.id));
      earned = new Set(ids.filter((n) => Number.isInteger(n) && valid.has(n)));
      saveProgress();
      renderAll();
      $('save-note').textContent = 'Progress imported: ' + earned.size + ' of ' + trophies.length + ' earned.';
    } catch (err) {
      $('save-note').textContent = 'Import failed: ' + err.message;
    }
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!window.confirm('Clear all earned trophies? This cannot be undone (unless you exported first).')) return;
  earned = new Set();
  saveProgress();
  renderAll();
}

/* ---------------- filtering ---------------- */

function isSpoilerHidden(trophy) {
  return spoilerOn && trophy.kind === 'story' && !earned.has(trophy.id);
}

function filterTrophies() {
  const query = searchQuery.trim().toLowerCase();
  return trophies.filter((t) => {
    if (kindFilter === 'missable' && !t.missable) return false;
    if (kindFilter !== 'all' && kindFilter !== 'missable' && t.kind !== kindFilter) return false;
    if (gradeFilter !== 'all' && t.grade !== gradeFilter) return false;
    if (earnedFilter === 'earned' && !earned.has(t.id)) return false;
    if (earnedFilter === 'unearned' && earned.has(t.id)) return false;
    if (query) {
      const hay = (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

/* ---------------- rendering ---------------- */

function gradeTag(trophy) {
  return '<span class="tag tag-' + trophy.grade + '">' + trophy.grade + '</span>';
}

function renderTrophyList() {
  const list = $('trophy-list');
  const shown = filterTrophies();
  $('list-meta').textContent = 'Showing ' + shown.length + ' of ' + trophies.length + ' trophies'
    + (earned.size ? ' · ' + earned.size + ' earned' : '');
  if (shown.length === 0) {
    list.innerHTML = '<li class="empty-state">No trophies match these filters. Clear the search or pick another filter.</li>';
    return;
  }
  list.innerHTML = shown.map((t) => {
    const hidden = isSpoilerHidden(t);
    const name = hidden ? 'Hidden story trophy' : escapeHtml(t.name);
    const desc = hidden ? 'Earn this trophy to reveal its name and description.' : escapeHtml(t.description);
    const tags = gradeTag(t)
      + (t.hidden ? '<span class="tag tag-hidden">Hidden</span>' : '')
      + (t.missable ? '<span class="tag tag-missable">Missable</span>' : '')
      + '<span class="tag tag-kind">' + KIND_LABELS[t.kind] + '</span>';
    return '<li><button type="button" class="trophy-row' + (earned.has(t.id) ? ' earned' : '')
      + (selectedId === t.id ? ' selected' : '') + '" data-id="' + t.id + '">'
      + '<input type="checkbox" class="trophy-check" data-check="' + t.id + '"'
      + (earned.has(t.id) ? ' checked' : '') + ' aria-label="Mark ' + escapeHtml(t.name) + ' as earned">'
      + '<span class="trophy-body"><span class="trophy-name">' + name + '</span>'
      + '<span class="trophy-desc">' + desc + '</span>'
      + '<span class="trophy-tags">' + tags + '</span></span>'
      + '</button></li>';
  }).join('');
}

function renderGuide() {
  const panel = $('guide-panel');
  const trophy = trophies.find((t) => t.id === selectedId);
  if (!trophy) {
    panel.innerHTML = '<p class="guide-empty"><strong>Pick a trophy</strong> to see its guide here — what to do, where and how, when it can be missed, and where the facts come from.</p>'
      + '<p class="guide-empty">Tip: turn on “Hide story spoilers” and the story trophies stay hidden until you earn them.</p>';
    return;
  }
  if (isSpoilerHidden(trophy)) {
    panel.innerHTML = '<h2>Hidden story trophy</h2>'
      + '<p class="guide-empty">Spoilers are hidden. Earn this trophy in the game to reveal its name, description and guide — or turn the spoiler setting off.</p>'
      + '<div class="earned-toggle"><button type="button" data-toggle="' + trophy.id + '">Mark as earned</button></div>';
    return;
  }
  const steps = (trophy.steps || []).map((s) => '<li>' + escapeHtml(s) + '</li>').join('');
  const sources = (trophy.sources || []).map((s) => {
    const label = escapeHtml(s.name);
    return s.url ? '<li><a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + label + '</a></li>'
      : '<li>' + label + '</li>';
  }).join('');
  const unconfirmed = /unconfirmed/i.test(trophy.guide)
    ? '<div class="unconfirmed-note"><strong>Unconfirmed detail:</strong> no guide has verified the exact trigger for this trophy yet. The guide above says what the description suggests — treat it as a lead, not a fact.</div>'
    : '';
  const missable = trophy.missable
    ? '<div class="missable-warning"><strong>Missable warning.</strong> ' + escapeHtml(trophy.missableNote || 'This trophy can be missed.') + '</div>'
    : '';
  panel.innerHTML = '<h2>' + escapeHtml(trophy.name) + '</h2>'
    + '<div class="trophy-tags">' + gradeTag(trophy)
    + (trophy.hidden ? '<span class="tag tag-hidden">Hidden</span>' : '')
    + (trophy.missable ? '<span class="tag tag-missable">Missable</span>' : '')
    + '<span class="tag tag-kind">' + KIND_LABELS[trophy.kind] + '</span></div>'
    + '<p class="official">' + escapeHtml(trophy.description) + '</p>'
    + '<h3>Guide</h3><p>' + escapeHtml(trophy.guide) + '</p>'
    + missable + unconfirmed
    + (steps ? '<h3>Steps</h3><ol>' + steps + '</ol>' : '')
    + '<h3>Sources</h3><ul class="source-list">' + sources + '</ul>'
    + '<div class="earned-toggle"><button type="button" data-toggle="' + trophy.id + '"'
    + (earned.has(trophy.id) ? ' class="earned"' : '') + '>'
    + (earned.has(trophy.id) ? 'Earned ✓ — tap to unmark' : 'Mark as earned') + '</button></div>';
}

function renderRoadmap() {
  const list = $('roadmap-list');
  list.innerHTML = roadmap.map((stage) => {
    const items = stage.items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
    return '<li class="roadmap-stage"><h2>Stage ' + stage.stage + ': ' + escapeHtml(stage.title)
      + '<span class="stage-time">' + escapeHtml(stage.time) + '</span></h2><ul>' + items + '</ul></li>';
  }).join('');
  const missables = trophies.filter((t) => t.missable);
  $('missable-box').innerHTML = '<h2>Missable trophies: ' + missables.length + '</h2>'
    + missables.map((t) => '<p><strong>' + escapeHtml(t.name) + '</strong> — ' + escapeHtml(t.missableNote || '') + '</p>').join('')
    + '<p>Everything else can be finished in free roam after the credits. The Race Against Yago in Chapter 3 is time-sensitive (it counts toward Strangers &amp; Freaks), so do it the moment it appears.</p>';
}

function updateProgress() {
  const total = trophies.length;
  const count = earned.size;
  const pct = total ? Math.round((count / total) * 100) : 0;
  $('progress-count').textContent = count + ' / ' + total + ' earned';
  const byGrade = ['platinum', 'gold', 'silver', 'bronze'].map((g) => {
    const n = trophies.filter((t) => t.grade === g && earned.has(t.id)).length;
    const of = trophies.filter((t) => t.grade === g).length;
    return n + '/' + of + ' ' + g;
  }).join(' · ');
  $('progress-detail').textContent = byGrade;
  $('progress-fill').style.width = pct + '%';
  $('progress-bar-wrap').setAttribute('aria-valuenow', String(count));
}

function renderAll() {
  updateProgress();
  renderTrophyList();
  renderGuide();
  if (currentView === 'roadmap') renderRoadmap();
}

/* ---------------- actions ---------------- */

function toggleTrophyEarned(id) {
  if (earned.has(id)) earned.delete(id);
  else earned.add(id);
  saveProgress();
  renderAll();
}

function applySpoilerSetting() {
  spoilerOn = $('spoiler').checked;
  saveProgress();
  renderAll();
}

function setView(view) {
  currentView = view;
  $('tab-tracker').classList.toggle('active', view === 'tracker');
  $('tab-roadmap').classList.toggle('active', view === 'roadmap');
  $('view-tracker').hidden = view !== 'tracker';
  $('view-roadmap').hidden = view !== 'roadmap';
  if (view === 'roadmap') renderRoadmap();
}

/* Screenshot scenes (?shot=...) — the same real app, preset for a shot script. */
function applyShotParams() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return;
  if (params.get('filter')) {
    kindFilter = params.get('filter');
    document.querySelectorAll('#kind-filters .chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.kind === kindFilter);
    });
  }
  if (shot === 'roadmap') setView('roadmap');
  if (shot === 'spoiler') {
    spoilerOn = true;
    $('spoiler').checked = true;
  }
  if (shot === 'guide' && params.get('id')) {
    selectedId = Number(params.get('id'));
  }
}

/* ---------------- wiring ---------------- */

function wireEvents() {
  $('trophy-list').addEventListener('click', (event) => {
    const check = event.target.closest('[data-check]');
    if (check) {
      event.stopPropagation();
      toggleTrophyEarned(Number(check.dataset.check));
      return;
    }
    const row = event.target.closest('[data-id]');
    if (row) {
      selectedId = Number(row.dataset.id);
      renderTrophyList();
      renderGuide();
    }
  });
  $('guide-panel').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-toggle]');
    if (btn) toggleTrophyEarned(Number(btn.dataset.toggle));
  });
  $('kind-filters').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-kind]');
    if (!chip) return;
    kindFilter = chip.dataset.kind;
    document.querySelectorAll('#kind-filters .chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderTrophyList();
  });
  $('grade-filter').addEventListener('change', (event) => {
    gradeFilter = event.target.value;
    renderTrophyList();
  });
  $('earned-filter').addEventListener('change', (event) => {
    earnedFilter = event.target.value;
    renderTrophyList();
  });
  $('search').addEventListener('input', (event) => {
    searchQuery = event.target.value;
    renderTrophyList();
  });
  $('spoiler').addEventListener('change', applySpoilerSetting);
  $('export-btn').addEventListener('click', exportProgress);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (event) => {
    if (event.target.files && event.target.files[0]) importProgress(event.target.files[0]);
    event.target.value = '';
  });
  $('reset-btn').addEventListener('click', resetProgress);
  $('tab-tracker').addEventListener('click', () => setView('tracker'));
  $('tab-roadmap').addEventListener('click', () => setView('roadmap'));
}

async function init() {
  loadProgress();
  $('spoiler').checked = spoilerOn;
  wireEvents();
  const response = await fetch(DATA_URL);
  if (!response.ok) throw new Error('Could not load ' + DATA_URL);
  const data = await response.json();
  trophies = data.trophies || [];
  roadmap = data.roadmap || [];
  if (trophies.length > 0 && selectedId === null) selectedId = trophies[0].id;
  applyShotParams();
  renderAll();
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    $('trophy-list').innerHTML = '<li class="empty-state">Could not load the trophy data: ' + escapeHtml(err.message) + '</li>';
  });
});
