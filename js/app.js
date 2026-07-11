/* Housestyle — main app: Problems Panel rendering, score card, tab switching,
   click-to-navigate, and all event wiring. Loaded last, after every other
   script, since it's the only file that touches the DOM. */

(function () {
'use strict';

const SAMPLE_MD = `# The Real Cost of Ad Fatigue

Every media buyer has seen it: a creative that crushed it for two weeks suddenly stops converting. The CPM creeps up, the CTR falls off a cliff, and nobody can say exactly when it happened, which is basically the whole problem in one sentence.

## Why fatigue sneaks up on you

Most teams react instead of watching for warning signs. By the time someone notices, budget has already been wasted for days. Frequency is the number to watch — when it crosses a threshold and CTR drops at the same time, that's fatigue, not a bad day.

### Three signals worth tracking

- CTR drops more than 25% versus the first five days
- Frequency crosses your configured threshold
- CPM rises while frequency is already high

Ignoring these signals is just guessing, and guessing is expensive!!! A single tired creative left running for a week can quietly burn a meaningful share of monthly budget without anyone noticing until the report lands.

## What to do about it

Rotate the creative before performance craters, not after. Follow these steps every week:

1. Pull frequency and CTR by creative
2. Flag anything past the threshold
3. Rotate flagged creatives before the next spend cycle

Teams that track this systematically waste less budget and ship better creative faster.

[Read more about creative testing](https://example.com/creative-testing)

![Fatigue curve example](https://example.com/chart.png)
`;

let faqItems = [];

/* ---------- score presentation ---------- */

function scoreLabel(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs work';
  return 'Poor';
}
function scoreClass(score) {
  if (score >= 90) return 'good';
  if (score >= 75) return '';
  if (score >= 50) return 'warn';
  return 'bad';
}

/* ---------- tab switching ---------- */

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.querySelector('.tab-btn[data-tab="' + name + '"]').classList.add('active');
  document.getElementById('tab-' + name).style.display = 'block';
  if (name === 'analysis') runAnalysis();
  if (name === 'export') runExportPrep();
}

/* ---------- click-to-navigate ---------- */

function jumpToLocation(loc) {
  switchTab('editor');
  if (!loc || loc.type === 'none') return;
  if (loc.type === 'field') {
    const el = document.getElementById(loc.id);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    return;
  }
  if (loc.type === 'text') {
    const ta = document.getElementById('markdownInput');
    ta.focus();
    ta.setSelectionRange(loc.start, loc.end);
    // best-effort scroll: browsers scroll a focused textarea's caret into view
    // on selection change, which is enough for a jump-to-problem interaction.
  }
}

/* ---------- Problems Panel ---------- */

// Tracks which occurrence is currently shown for a rule that has more than
// one (e.g. "double spaces" with 5 hits). Keyed by rule id, resets naturally
// since it's just read with `|| 0` — a stale index safely falls back to the
// rule's primary location if the occurrence count shrinks between analyses.
let occurrenceIndex = {};

function fieldLabel(id) {
  const labels = { seoTitle: 'SEO title field', seoMeta: 'Meta description field', seoSlug: 'Slug field', seoKeyword: 'Focus keyword field' };
  return labels[id] || id;
}

function flatResults(all) {
  return [].concat(all.structure, all.readability, all.formatting, all.seo, all.accessibility);
}

function renderProblemRow(r, md) {
  const esc = HS.util.escapeHtml;
  const loc = r.location || { type: 'none' };
  const clickable = loc.type !== 'none';
  const hasMultiple = r.locations && r.locations.length > 1;
  let locationHtml;

  if (loc.type === 'text') {
    const idx = hasMultiple ? (occurrenceIndex[r.id] || 0) % r.locations.length : 0;
    const activeLoc = (r.locations && r.locations[idx]) || loc;
    const s = HS.util.textSnippet(md, activeLoc.start, activeLoc.end);
    locationHtml = `<div class="problem-snippet">${esc(s.before)}<mark>${esc(s.match)}</mark>${esc(s.after)}</div>`;
    if (hasMultiple) {
      locationHtml += `<div class="occurrence-nav">
        <span class="occurrence-count">${idx + 1} of ${r.locations.length}</span>
        <button type="button" class="btn-secondary small next-occurrence" data-id="${r.id}">Next occurrence →</button>
      </div>`;
    }
  } else if (loc.type === 'field') {
    locationHtml = `<div class="problem-snippet problem-field-tag">→ ${esc(fieldLabel(loc.id))}</div>`;
  } else {
    locationHtml = `<div class="problem-snippet problem-whole-doc">Whole-document metric — no single spot to point to.</div>`;
  }

  // A dedicated button, not the whole row: tapping anywhere on the card
  // (to read it, to scroll past it) shouldn't also count as "take me to the
  // editor" — especially on mobile, where a large tap target overlapping a
  // smaller "Next occurrence" button inside it is a real mis-tap risk.
  const jumpBtn = clickable ? `<button type="button" class="jump-btn" data-id="${r.id}">↗ Jump to it</button>` : '';
  const fixBadge = r.fixable ? '<button type="button" class="fixable-badge" data-open-autofix="1">\uD83D\uDD27 Auto-fixable</button>' : '';

  return `<div class="problem-row" data-id="${r.id}">
    <div class="problem-text">
      <div class="problem-title">${esc(r.title)}${jumpBtn}${fixBadge}</div>
      <div class="problem-detail">${esc(r.detail)}</div>
      ${locationHtml}
    </div>
    <span class="category-tag">${r.category}</span>
  </div>`;
}

function renderProblemsPanel(grouped, md) {
  const sections = [
    { key: 'critical', label: 'Critical', icon: '🔴' },
    { key: 'warning', label: 'Warnings', icon: '🟡' },
    { key: 'suggestion', label: 'Suggestions', icon: '🔵' }
  ];
  const container = document.getElementById('problemsPanel');

  if (grouped.total === 0) {
    container.innerHTML = '<div class="empty-note">Paste an article in the Editor tab to see results here.</div>';
    return;
  }
  if (grouped.critical.length + grouped.warning.length + grouped.suggestion.length === 0) {
    container.innerHTML = `<div class="all-clear">✅ No problems found across ${grouped.total} checks.</div>`;
    return;
  }

  container.innerHTML = sections.map(function (s) {
    const items = grouped[s.key];
    if (!items.length) return '';
    return `<div class="problem-group">
      <div class="problem-group-header">${s.icon} ${s.label} <span class="count-pill">${items.length}</span></div>
      ${items.map(r => renderProblemRow(r, md)).join('')}
    </div>`;
  }).join('');

  function jumpToRule(id) {
    const all = window.__hsLastResults;
    if (!all) return;
    const rule = flatResults(all).find(r => r.id === id);
    if (!rule) return;
    const idx = rule.locations && rule.locations.length ? (occurrenceIndex[id] || 0) % rule.locations.length : 0;
    const loc = (rule.locations && rule.locations[idx]) || rule.location;
    jumpToLocation(loc);
  }

  container.querySelectorAll('.next-occurrence').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const all = window.__hsLastResults;
      if (!all) return;
      const rule = flatResults(all).find(r => r.id === btn.dataset.id);
      if (!rule || !rule.locations) return;
      occurrenceIndex[btn.dataset.id] = ((occurrenceIndex[btn.dataset.id] || 0) + 1) % rule.locations.length;
      jumpToRule(btn.dataset.id);
      renderProblemsPanel(grouped, md); // refresh so the "N of M" label and snippet reflect the new occurrence
    });
  });

  container.querySelectorAll('[data-open-autofix]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab('editor');
      const autoFixBtn = document.getElementById('btnAutoFix');
      if (autoFixBtn) autoFixBtn.click();
    });
  });

  container.querySelectorAll('.jump-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { jumpToRule(btn.dataset.id); });
  });
}

/* ---------- Auto-Fix preview (granular, Before/After, per-change) ---------- */

let currentFixCandidates = [];

function getCheckedFixIds() {
  return Array.from(document.querySelectorAll('#autofixSummary input[data-fix-id]:checked')).map(el => el.dataset.fixId);
}

function updateLiveScorePreview(md) {
  const checked = new Set(getCheckedFixIds());
  const selected = currentFixCandidates.filter(c => checked.has(c.id));
  const hypothetical = HS.rules.applyFixCandidates(md, selected);
  const seo = currentSeo();
  const before = computeScores(md, seo);
  const after = computeScores(hypothetical, seo);

  const box = document.getElementById('autofixLiveScore');
  if (box) box.innerHTML = `Overall Publishing Score if applied: <strong>${before.overall} → ${after.overall}</strong> &nbsp;·&nbsp; ${selected.length} of ${currentFixCandidates.length} selected`;

  const applyBtn = document.getElementById('btnApplySelectedFixes');
  if (applyBtn) {
    applyBtn.disabled = selected.length === 0;
    applyBtn.textContent = selected.length ? `Apply ${selected.length} selected change${selected.length === 1 ? '' : 's'}` : 'Nothing selected';
  }
}

function wireFixPreviewInteractions(md) {
  document.querySelectorAll('#autofixSummary input[data-fix-id]').forEach(function (cb) {
    cb.addEventListener('change', function () { updateLiveScorePreview(md); });
  });
  document.getElementById('btnSelectAllFixes').addEventListener('click', function () {
    document.querySelectorAll('#autofixSummary input[data-fix-id]').forEach(cb => { cb.checked = true; });
    updateLiveScorePreview(md);
  });
  document.getElementById('btnDeselectAllFixes').addEventListener('click', function () {
    document.querySelectorAll('#autofixSummary input[data-fix-id]').forEach(cb => { cb.checked = false; });
    updateLiveScorePreview(md);
  });
  document.getElementById('btnCancelFixPreview').addEventListener('click', function () {
    document.getElementById('autofixSummary').style.display = 'none';
    currentFixCandidates = [];
  });
  document.getElementById('btnApplySelectedFixes').addEventListener('click', function () {
    const checked = new Set(getCheckedFixIds());
    const selected = currentFixCandidates.filter(c => checked.has(c.id));
    if (!selected.length) return;
    const appliedEverythingShown = selected.length === currentFixCandidates.length;

    const mdInputEl = document.getElementById('markdownInput');
    const seo = currentSeo();
    const before = computeScores(mdInputEl.value, seo);
    let totalApplied = selected.length;
    mdInputEl.value = HS.rules.applyFixCandidates(mdInputEl.value, selected);

    // If everything shown got selected, take one more pass: some fixes can
    // reveal a new issue as a side effect (removing an empty heading can turn
    // a previously-fine H1 -> H3 step into a real skip). A partial selection
    // is left exactly as chosen — this only follows through on "clean it all up".
    if (appliedEverythingShown) {
      const followUp = HS.engine.getAllFixCandidates(mdInputEl.value);
      if (followUp.length) {
        mdInputEl.value = HS.rules.applyFixCandidates(mdInputEl.value, followUp);
        totalApplied += followUp.length;
      }
    }

    updatePreview();
    updateWordCount();
    refreshSeoSuggestions();
    saveDraft();
    const after = computeScores(mdInputEl.value, seo);
    updateMiniBadge(after.overall, HS.engine.groupBySeverity(after.allResults).critical.length);

    const summary = document.getElementById('autofixSummary');
    summary.classList.add('autofix-applied');
    const changedCats = Object.keys(after.categoryScores).filter(function (k) { return after.categoryScores[k] !== before.categoryScores[k]; });
    const catLine = changedCats.map(function (k) {
      return k.charAt(0).toUpperCase() + k.slice(1) + ' ' + before.categoryScores[k] + ' \u2192 ' + after.categoryScores[k];
    }).join(' &nbsp;\u00b7&nbsp; ');
    summary.innerHTML =
      `<strong>Applied ${totalApplied} change${totalApplied === 1 ? '' : 's'}</strong>` +
      `<div class="autofix-scores">Overall ${before.overall} → ${after.overall}${catLine ? ' &nbsp;·&nbsp; ' + catLine : ''}</div>` +
      `<button type="button" class="btn-secondary small" id="dismissAutofixSummary" style="margin-top:0.6rem;">Dismiss</button>`;
    document.getElementById('dismissAutofixSummary').addEventListener('click', function () { summary.style.display = 'none'; });
    currentFixCandidates = [];
  });
}

function renderFixPreview(candidates, md) {
  currentFixCandidates = candidates;
  const panel = document.getElementById('autofixSummary');
  panel.style.display = 'block';
  panel.classList.remove('autofix-applied');

  if (!candidates.length) {
    panel.innerHTML = 'Nothing to fix — no mechanical formatting issues found.';
    return;
  }

  const esc = HS.util.escapeHtml;
  const byCategory = {};
  candidates.forEach(function (c) { (byCategory[c.category] = byCategory[c.category] || []).push(c); });

  const groupsHtml = Object.keys(byCategory).map(function (cat) {
    const items = byCategory[cat];
    const rows = items.map(function (c) {
      const s = HS.util.textSnippet(md, c.start, c.end);
      const insHtml = c.after ? '<ins>' + esc(c.after) + '</ins>' : '';
      return '<label class="fix-candidate">' +
        '<input type="checkbox" checked data-fix-id="' + c.id + '">' +
        '<span class="fix-snippet">' + esc(s.before) + '<del>' + esc(s.match) + '</del>' + insHtml + esc(s.after) + '</span>' +
        '</label>';
    }).join('');
    return '<div class="fix-group"><div class="fix-group-header">' + esc(cat) + ' <span class="count-pill">' + items.length + '</span></div>' + rows + '</div>';
  }).join('');

  panel.innerHTML =
    '<div class="autofix-review-header"><strong>' + candidates.length + ' change' + (candidates.length === 1 ? '' : 's') + ' found</strong>' +
    '<div class="autofix-review-actions">' +
    '<button type="button" class="btn-secondary small" id="btnSelectAllFixes">Select all</button>' +
    '<button type="button" class="btn-secondary small" id="btnDeselectAllFixes">Deselect all</button>' +
    '</div></div>' +
    '<div class="autofix-live-score" id="autofixLiveScore"></div>' +
    groupsHtml +
    '<div class="autofix-review-footer">' +
    '<button type="button" class="btn-primary" id="btnApplySelectedFixes">Apply changes</button>' +
    '<button type="button" class="btn-secondary" id="btnCancelFixPreview">Cancel</button>' +
    '</div>';

  wireFixPreviewInteractions(md);
  updateLiveScorePreview(md);
}

/* ---------- analysis orchestration ---------- */

function currentSeo() {
  return {
    title: document.getElementById('seoTitle').value.trim(),
    meta: document.getElementById('seoMeta').value.trim(),
    slug: document.getElementById('seoSlug').value.trim(),
    keyword: document.getElementById('seoKeyword').value.trim(),
  };
}

/* Runs every rule and returns both the per-category scores and the overall
   weighted score in one call — used by runAnalysis() and by the Auto-Fix
   handler, so both always agree on what "the score" means. */
function computeScores(md, seo) {
  const allResults = HS.engine.runAllRules(md, seo);
  const categoryScores = {
    structure: HS.engine.categoryScore(allResults.structure),
    readability: HS.engine.categoryScore(allResults.readability),
    formatting: HS.engine.categoryScore(allResults.formatting),
    seo: HS.engine.categoryScore(allResults.seo),
    accessibility: HS.engine.categoryScore(allResults.accessibility),
  };
  return { allResults, categoryScores, overall: HS.engine.overallScore(categoryScores) };
}

function runAnalysis() {
  const md = document.getElementById('markdownInput').value;

  if (!md.trim()) {
    document.getElementById('problemsPanel').innerHTML = '<div class="empty-note">Paste an article in the Editor tab to see results here.</div>';
    document.getElementById('statsGrid').innerHTML = '';
    document.getElementById('scoreNumber').textContent = '—';
    document.getElementById('scoreNumber').className = 'score-number';
    document.getElementById('scoreLabel').textContent = '';
    document.getElementById('scoreBreakdown').innerHTML = '';
    document.getElementById('scoreMiniBadge').textContent = '';
    document.getElementById('scoreMiniBadge').className = 'mini-badge';
    document.getElementById('readinessBanner').style.display = 'none';
    window.__hsLastResults = null;
    return;
  }

  const seo = currentSeo();
  const stats = HS.engine.computeStats(md);
  const { allResults, categoryScores, overall } = computeScores(md, seo);
  window.__hsLastResults = allResults;

  const statsGrid = document.getElementById('statsGrid');
  const statEntries = [
    ['words','Words'], ['characters','Characters'], ['paragraphs','Paragraphs'], ['sentences','Sentences'],
    ['headings','Headings'], ['images','Images'], ['links','Links'], ['readingTime','Read (min)'], ['speakingTime','Speak (min)']
  ];
  statsGrid.innerHTML = statEntries.map(([key,label]) => `<div class="stat-box"><div class="value">${stats[key]}</div><div class="label">${label}</div></div>`).join('');

  updateScoreDisplay(categoryScores, overall);

  const grouped = HS.engine.groupBySeverity(allResults);
  renderProblemsPanel(grouped, md);
  updateMiniBadge(overall, grouped.critical.length);
  updateReadinessBanner(overall, grouped.critical.length);
}

function updateReadinessBanner(overall, criticalCount) {
  const readiness = HS.engine.publishReadiness(overall, criticalCount, HS.settings.current.readyThreshold);
  const banner = document.getElementById('readinessBanner');
  banner.style.display = 'flex';
  const cls = readiness.status === 'green' ? 'ready' : readiness.status === 'yellow' ? 'almost' : 'blocked';
  const label = readiness.status === 'green' ? '\u2705 Ready to publish' : readiness.status === 'yellow' ? '\uD83D\uDFE1 Almost there' : '\uD83D\uDD34 Not ready yet';
  banner.className = 'readiness-banner ' + cls;
  banner.innerHTML = '<span class="readiness-dot"></span><span>' + label + ' \u2014 ' + HS.util.escapeHtml(readiness.reason) + '</span>';
}

function updateScoreDisplay(categoryScores, overall) {
  const scoreNumberEl = document.getElementById('scoreNumber');
  scoreNumberEl.textContent = overall;
  scoreNumberEl.className = 'score-number ' + scoreClass(overall);
  document.getElementById('scoreLabel').textContent = scoreLabel(overall);

  document.getElementById('scoreBreakdown').innerHTML = Object.entries(categoryScores).map(([key, val]) => `
    <div class="score-item">
      <span class="score-item-label">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
      <span class="score-item-value">${val === null ? '—' : val}</span>
    </div>
  `).join('');
}

function updateMiniBadge(overall, criticalCount) {
  const badge = document.getElementById('scoreMiniBadge');
  const readiness = HS.engine.publishReadiness(overall, criticalCount, HS.settings.current.readyThreshold);
  badge.textContent = '';
  badge.className = 'mini-badge mini-badge-' + readiness.status;
  badge.title = 'Publishing Score ' + overall + '/100 \u2014 ' + readiness.reason;
}

function updatePreview() {
  const md = document.getElementById('markdownInput').value;
  const pane = document.getElementById('previewPane');
  if (!md.trim()) { pane.innerHTML = ''; return; }
  if (typeof marked === 'undefined') {
    pane.innerHTML = '<div class="empty-note">Preview needs the marked.js library from jsdelivr.net, which hasn\u2019t loaded — check your connection.</div>';
    return;
  }
  pane.innerHTML = marked.parse(md);
}

function updateWordCount() {
  const md = document.getElementById('markdownInput').value;
  const words = HS.util.getWords(HS.util.stripMarkdown(md)).length;
  document.getElementById('wordCountBadge').textContent = `${words} word${words === 1 ? '' : 's'}`;
}

/* ---------- formatting toolbar ---------- */

function applyFormat(ta, action) {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const value = ta.value;
  const selected = value.slice(start, end);

  function wrap(marker, placeholder) {
    const text = selected || placeholder;
    ta.value = value.slice(0, start) + marker + text + marker + value.slice(end);
    if (selected) {
      ta.selectionStart = start + marker.length;
      ta.selectionEnd = start + marker.length + text.length;
    } else {
      ta.selectionStart = start + marker.length;
      ta.selectionEnd = start + marker.length + placeholder.length;
    }
  }

  function prefixLine(marker) {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    ta.value = value.slice(0, lineStart) + marker + value.slice(lineStart);
    const delta = marker.length;
    ta.selectionStart = start + delta;
    ta.selectionEnd = end + delta;
  }

  function insertLinkLike(openBracket, placeholderText, placeholderUrl) {
    if (selected) {
      ta.value = value.slice(0, start) + openBracket + selected + '](' + placeholderUrl + ')' + value.slice(end);
      const urlStart = start + openBracket.length + selected.length + 2;
      ta.selectionStart = urlStart;
      ta.selectionEnd = urlStart + placeholderUrl.length;
    } else {
      ta.value = value.slice(0, start) + openBracket + placeholderText + '](' + placeholderUrl + ')' + value.slice(end);
      ta.selectionStart = start + openBracket.length;
      ta.selectionEnd = start + openBracket.length + placeholderText.length;
    }
  }

  switch (action) {
    case 'bold': wrap('**', 'bold text'); break;
    case 'italic': wrap('*', 'italic text'); break;
    case 'h1': prefixLine('# '); break;
    case 'h2': prefixLine('## '); break;
    case 'h3': prefixLine('### '); break;
    case 'ul': prefixLine('- '); break;
    case 'ol': prefixLine('1. '); break;
    case 'quote': prefixLine('> '); break;
    case 'link': insertLinkLike('[', 'link text', 'https://'); break;
    case 'image': insertLinkLike('![', 'alt text', 'https://'); break;
    case 'hr': {
      const needsLead = start > 0 && value[start - 1] !== '\n';
      const insert = (needsLead ? '\n\n' : '') + '---\n\n';
      ta.value = value.slice(0, start) + insert + value.slice(start);
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      break;
    }
  }
}



/* ---------- inline SEO suggestions (Editor tab) ---------- */

function wireSuggestion(fieldId, rowId, textId, btnId, suggestion) {
  const row = document.getElementById(rowId);
  const field = document.getElementById(fieldId);
  if (!suggestion || suggestion === field.value) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  document.getElementById(textId).textContent = suggestion;
  // Reassigning .onclick (not addEventListener) on purpose: this runs on every
  // keystroke via the debounced input handler, and addEventListener would stack
  // a new listener each time, firing the apply action multiple times per click.
  document.getElementById(btnId).onclick = function () {
    field.value = suggestion;
    row.style.display = 'none';
  };
}

function refreshSeoSuggestions() {
  const md = document.getElementById('markdownInput').value;
  const derived = md.trim() ? HS.engine.deriveMetaFromContent(md) : { title: '', description: '', slug: '', excerpt: '' };
  wireSuggestion('seoTitle', 'suggestTitleRow', 'suggestTitleText', 'btnApplyTitle', derived.title);
  wireSuggestion('seoMeta', 'suggestMetaRow', 'suggestMetaText', 'btnApplyMeta', derived.description);
  wireSuggestion('seoSlug', 'suggestSlugRow', 'suggestSlugText', 'btnApplySlug', derived.slug);
  wireSuggestion('seoExcerpt', 'suggestExcerptRow', 'suggestExcerptText', 'btnApplyExcerpt', derived.excerpt);
}

/* ---------- export tab ---------- */

function runExportPrep() {
  const md = document.getElementById('markdownInput').value;

  const toc = HS.engine.generateTOC(md);
  const tocEl = document.getElementById('tocPreview');
  if (!md.trim()) {
    tocEl.innerHTML = '<div class="empty-note">Paste an article in the Editor tab first.</div>';
  } else if (!toc) {
    tocEl.innerHTML = '<div class="empty-note">Add a few H2–H4 headings to generate a table of contents.</div>';
  } else {
    tocEl.innerHTML = '<ul class="toc-list">' + toc.map(h => `<li style="margin-left:${(h.level - 2) * 1.1}rem"><a href="#${h.anchor}">${HS.util.escapeHtml(h.text)}</a></li>`).join('') + '</ul>';
  }

  updateFaqPreview();
}

/* ---------- FAQ builder ---------- */

function renderFaqList() {
  const container = document.getElementById('faqList');
  if (!faqItems.length) {
    container.innerHTML = '<div class="empty-note">No questions yet — add one below.</div>';
    return;
  }
  container.innerHTML = faqItems.map(function (item, i) {
    return '<div class="faq-item">' +
      '<input type="text" placeholder="Question" value="' + HS.util.escapeHtml(item.q) + '" data-idx="' + i + '" data-field="q" class="faq-input">' +
      '<textarea placeholder="Answer" rows="2" data-idx="' + i + '" data-field="a" class="faq-input">' + HS.util.escapeHtml(item.a) + '</textarea>' +
      '<button class="btn-secondary small" data-remove="' + i + '" type="button" style="margin-top:0.5rem;">Remove</button>' +
      '</div>';
  }).join('');

  container.querySelectorAll('.faq-input').forEach(function (el) {
    el.addEventListener('input', function () {
      faqItems[+this.dataset.idx][this.dataset.field] = this.value;
      updateFaqPreview();
      saveDraft();
    });
  });
  container.querySelectorAll('[data-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      faqItems.splice(+this.dataset.remove, 1);
      renderFaqList();
      updateFaqPreview();
      saveDraft();
    });
  });
}

function updateFaqPreview() {
  const format = document.getElementById('faqFormat').value;
  let out = '';
  if (format === 'generic') out = HS.exportFmt.faqToGenericBlocks(faqItems);
  else if (format === 'plainlist') out = HS.exportFmt.faqToPlainList(faqItems);
  else if (format === 'jsonld') out = HS.exportFmt.faqToJsonLd(faqItems);
  document.getElementById('faqPreview').textContent = out || 'Add at least one question to see output here.';
}

/* ---------- Settings tab ---------- */

const SETTINGS_FIELD_IDS = ['setMaxSentenceWarn','setMaxSentenceCritical','setMaxParagraphWords','setPassiveSuggest','setPassiveWarn','setTargetReadingGrade','setMinHeadingsForToc','setTitleIdealMin','setTitleIdealMax','setMetaIdealMin','setMetaIdealMax','setKeywordDensityMin','setKeywordDensityMax'];

function populateSettingsForm() {
  SETTINGS_FIELD_IDS.forEach(function (id) {
    const el = document.getElementById(id);
    el.value = HS.settings.current[el.dataset.key];
  });
  document.querySelectorAll('.preset-btn').forEach(function (btn) {
    btn.classList.toggle('active', HS.settings.current.presetName === btn.dataset.preset);
  });
  document.getElementById('setAvoidPhrases').value = HS.util.normalizeAvoidPhrases(HS.settings.current.avoidPhrases)
    .map(function (e) { return e.replacement ? (e.term + ' -> ' + e.replacement) : e.term; }).join('\n');
  document.getElementById('setCustomFillerWords').value = (HS.settings.current.customFillerWords || []).join('\n');
  document.getElementById('setMinWordCount').value = HS.settings.current.minWordCount || 0;
  document.getElementById('setMaxWordCount').value = HS.settings.current.maxWordCount || 0;
  document.getElementById('setReadyThreshold').value = HS.settings.current.readyThreshold;
  document.getElementById('setRequiredHeadings').value = (HS.settings.current.requiredHeadingPatterns || []).join('\n');
  renderChecksToggleGrid();
}

function wirePolicySetting(fieldId, settingsKey, isNumber) {
  document.getElementById(fieldId).addEventListener('change', function () {
    const val = isNumber ? (parseFloat(this.value) || 0) : this.value;
    HS.settings.current = Object.assign({}, HS.settings.current, { [settingsKey]: val });
    HS.settings.save(HS.settings.current);
    flashSettingsFeedback('Saved');
  });
}

function readSettingsFromForm() {
  const next = Object.assign({}, HS.settings.current);
  SETTINGS_FIELD_IDS.forEach(function (id) {
    const el = document.getElementById(id);
    const val = parseFloat(el.value);
    if (!isNaN(val)) next[el.dataset.key] = val;
  });
  next.presetName = 'custom';
  return next;
}

function flashSettingsFeedback(text) {
  const fb = document.getElementById('settingsFeedback');
  fb.textContent = text;
  setTimeout(function () { fb.textContent = ''; }, 2000);
}

function parseLines(text) {
  return text.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
}

function wireWordListSetting(textareaId, settingsKey) {
  document.getElementById(textareaId).addEventListener('change', function () {
    HS.settings.current = Object.assign({}, HS.settings.current, { [settingsKey]: parseLines(this.value) });
    HS.settings.save(HS.settings.current);
    flashSettingsFeedback('Saved');
  });
}

function wireAvoidPhrasesSetting() {
  document.getElementById('setAvoidPhrases').addEventListener('change', function () {
    const entries = parseLines(this.value).map(function (line) {
      const parts = line.split('->');
      return { term: parts[0].trim(), replacement: parts.length > 1 ? parts.slice(1).join('->').trim() : null };
    }).filter(function (e) { return e.term; });
    HS.settings.current = Object.assign({}, HS.settings.current, { avoidPhrases: entries });
    HS.settings.save(HS.settings.current);
    flashSettingsFeedback('Saved');
  });
}

const CHECK_CATEGORY_LABELS = { structure: 'Structure', readability: 'Readability', formatting: 'Formatting', seo: 'SEO', accessibility: 'Accessibility' };

function renderChecksToggleGrid() {
  const container = document.getElementById('checksToggleGrid');
  const disabled = new Set(HS.settings.current.disabledChecks || []);
  const byCategory = {};
  HS.settings.ALL_CHECKS.forEach(function (c) {
    (byCategory[c.category] = byCategory[c.category] || []).push(c);
  });

  // A master checkbox per category, not just per individual check — someone
  // who doesn't publish to be found via search should be able to turn off
  // all of SEO in one click, not hunt down seven separate boxes.
  container.innerHTML = Object.keys(CHECK_CATEGORY_LABELS).map(function (cat) {
    const items = byCategory[cat] || [];
    const allEnabled = items.every(function (c) { return !disabled.has(c.id); });
    return '<div class="checks-toggle-group">' +
      '<label class="checks-toggle-header-row"><input type="checkbox" data-category-toggle="' + cat + '" ' + (allEnabled ? 'checked' : '') + '><span class="checks-toggle-header">' + CHECK_CATEGORY_LABELS[cat] + '</span></label>' +
      items.map(function (c) {
        const checked = disabled.has(c.id) ? '' : 'checked';
        return '<label class="checkbox-label check-toggle-row"><input type="checkbox" data-check-id="' + c.id + '" ' + checked + '> ' + HS.util.escapeHtml(c.title) + '</label>';
      }).join('') + '</div>';
  }).join('');

  container.querySelectorAll('input[data-category-toggle]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const cat = this.dataset.categoryToggle;
      const ids = (byCategory[cat] || []).map(function (c) { return c.id; });
      let list = HS.settings.current.disabledChecks || [];
      list = this.checked ? list.filter(function (id) { return ids.indexOf(id) === -1; }) : list.concat(ids.filter(function (id) { return list.indexOf(id) === -1; }));
      HS.settings.current = Object.assign({}, HS.settings.current, { disabledChecks: list });
      HS.settings.save(HS.settings.current);
      renderChecksToggleGrid();
      flashSettingsFeedback('Saved');
    });
  });

  container.querySelectorAll('input[data-check-id]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const id = this.dataset.checkId;
      let list = HS.settings.current.disabledChecks || [];
      list = this.checked ? list.filter(x => x !== id) : (list.includes(id) ? list : list.concat([id]));
      HS.settings.current = Object.assign({}, HS.settings.current, { disabledChecks: list });
      HS.settings.save(HS.settings.current);
      renderChecksToggleGrid();
      flashSettingsFeedback('Saved');
    });
  });
}

/* ---------- draft persistence ---------- */

const DRAFT_KEY = 'housestyle-draft-v1';

function saveDraft() {
  HS.storage.set(DRAFT_KEY, {
    markdown: document.getElementById('markdownInput').value,
    seoTitle: document.getElementById('seoTitle').value,
    seoMeta: document.getElementById('seoMeta').value,
    seoSlug: document.getElementById('seoSlug').value,
    seoKeyword: document.getElementById('seoKeyword').value,
    seoExcerpt: document.getElementById('seoExcerpt').value,
    faqItems: faqItems,
    savedAt: Date.now()
  });
}

function applyDraft(draft) {
  document.getElementById('markdownInput').value = draft.markdown || '';
  document.getElementById('seoTitle').value = draft.seoTitle || '';
  document.getElementById('seoMeta').value = draft.seoMeta || '';
  document.getElementById('seoSlug').value = draft.seoSlug || '';
  document.getElementById('seoKeyword').value = draft.seoKeyword || '';
  document.getElementById('seoExcerpt').value = draft.seoExcerpt || '';
  faqItems = Array.isArray(draft.faqItems) ? draft.faqItems : [];
  renderFaqList();
  updateFaqPreview();
  updatePreview();
  updateWordCount();
  refreshSeoSuggestions();
}

function offerDraftRestore() {
  const draft = HS.storage.get(DRAFT_KEY, null);
  if (!draft || !draft.markdown || !draft.markdown.trim()) return;
  const banner = document.getElementById('draftBanner');
  const words = HS.util.getWords(HS.util.stripMarkdown(draft.markdown)).length;
  const when = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : 'earlier';
  document.getElementById('draftBannerText').textContent = `Found a saved draft from ${when} (${words} words).`;
  banner.style.display = 'flex';

  document.getElementById('btnRestoreDraft').onclick = function () {
    applyDraft(draft);
    banner.style.display = 'none';
  };
  document.getElementById('btnDismissDraft').onclick = function () {
    banner.style.display = 'none';
  };
}

/* ---------- wiring ---------- */

document.addEventListener('DOMContentLoaded', function () {
  const mdInput = document.getElementById('markdownInput');

  // Lazy + defensive: if the turndown CDN script didn't load (offline, ad
  // blocker, corporate firewall, flaky connection), this must NOT throw here.
  // A throw at this point would stop every addEventListener below it from
  // ever running, which looks exactly like "no button responds to clicks" —
  // even for buttons that have nothing to do with turndown.
  let turndownService = null;
  function getTurndown() {
    if (turndownService) return turndownService;
    if (typeof TurndownService === 'undefined') return null;
    turndownService = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });
    return turndownService;
  }

  const debouncedUpdate = HS.util.debounce(function () { updatePreview(); updateWordCount(); refreshSeoSuggestions(); saveDraft(); }, 150);
  mdInput.addEventListener('input', debouncedUpdate);
  updatePreview();
  updateWordCount();
  refreshSeoSuggestions();
  renderFaqList();
  populateSettingsForm();
  offerDraftRestore();
  wireAvoidPhrasesSetting();
  wireWordListSetting('setCustomFillerWords', 'customFillerWords');
  wireWordListSetting('setRequiredHeadings', 'requiredHeadingPatterns');
  wirePolicySetting('setMinWordCount', 'minWordCount', true);
  wirePolicySetting('setMaxWordCount', 'maxWordCount', true);
  wirePolicySetting('setReadyThreshold', 'readyThreshold', true);

  document.getElementById('btnExportProfile').addEventListener('click', function () {
    const name = document.getElementById('exportProfileName').value.trim() || 'Housestyle profile';
    const profile = HS.settings.exportProfile(name);
    const filename = (HS.util.slugify(name) || 'housestyle-profile') + '.json';
    downloadFile(filename, JSON.stringify(profile, null, 2), 'application/json');
    const fb = document.getElementById('profileFeedback');
    fb.textContent = 'Exported ' + filename;
    setTimeout(function () { if (fb.textContent.indexOf('Exported') === 0) fb.textContent = ''; }, 3000);
  });

  document.getElementById('btnImportProfile').addEventListener('click', function () {
    document.getElementById('profileFileInput').click();
  });

  document.getElementById('profileFileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    const fb = document.getElementById('profileFeedback');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (err) {
        fb.textContent = 'That file isn\u2019t valid JSON.';
        e.target.value = '';
        return;
      }
      const result = HS.settings.sanitizeImported(parsed);
      if (!result) {
        fb.textContent = 'That doesn\u2019t look like a Housestyle profile.';
        e.target.value = '';
        return;
      }
      const label = result.name ? ('\u201C' + result.name + '\u201D') : 'this profile';
      if (!confirm('Import ' + label + '? This replaces your current thresholds, enabled checks, word lists, and editorial policy.')) {
        e.target.value = '';
        return;
      }
      HS.settings.current = result.settings;
      HS.settings.save(HS.settings.current);
      populateSettingsForm();
      runAnalysis(); // re-score whatever's in the editor against the newly-imported standard
      fb.textContent = 'Imported ' + label + '.';
      e.target.value = '';
    };
    reader.readAsText(file);
  });


  ['seoTitle','seoMeta','seoSlug','seoExcerpt'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () { refreshSeoSuggestions(); saveDraft(); });
  });

  document.querySelectorAll('.format-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyFormat(mdInput, btn.dataset.action);
      mdInput.focus();
      updatePreview();
      updateWordCount();
      refreshSeoSuggestions();
      saveDraft();
    });
  });

  mdInput.addEventListener('keydown', function (e) {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    if (e.key === 'b' || e.key === 'B') { e.preventDefault(); applyFormat(mdInput, 'bold'); updatePreview(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); applyFormat(mdInput, 'italic'); updatePreview(); }
  });

  mdInput.addEventListener('paste', function (e) {
    const html = e.clipboardData && e.clipboardData.getData('text/html');
    if (!html || !html.trim()) return; // no rich HTML on the clipboard -> let the normal plain-text paste happen
    const td = getTurndown();
    if (!td) return; // turndown didn't load -> fall back to the browser's default plain-text paste instead of failing
    e.preventDefault();
    const source = HS.paste.detectSource(html);
    const cleaned = HS.paste.cleanHtml(html);
    let md;
    try { md = td.turndown(cleaned); } catch (err) { return; }
    HS.paste.insertAtCursor(mdInput, md);
    document.getElementById('pasteFeedback').textContent = HS.paste.sourceLabel(source);
    setTimeout(() => { document.getElementById('pasteFeedback').textContent = ''; }, 3000);
    updatePreview();
    updateWordCount();
    refreshSeoSuggestions();
    saveDraft();
  });

  document.getElementById('btnImportDocx').addEventListener('click', function () {
    document.getElementById('docxFileInput').click();
  });
  document.getElementById('docxFileInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    const td = getTurndown();
    if (typeof mammoth === 'undefined' || !td) {
      alert('DOCX import needs the mammoth.js and turndown.js libraries from jsdelivr.net — they didn\u2019t load. Check your internet connection (or any ad blocker / firewall blocking cdn.jsdelivr.net) and try again.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = function () {
      mammoth.convertToHtml({ arrayBuffer: reader.result }).then(function (result) {
        const md = td.turndown(result.value);
        HS.paste.insertAtCursor(mdInput, md);
        updatePreview();
        updateWordCount();
        refreshSeoSuggestions();
        saveDraft();
        document.getElementById('pasteFeedback').textContent = 'Imported ' + file.name + ' — converted to Markdown';
        setTimeout(() => { document.getElementById('pasteFeedback').textContent = ''; }, 3000);
      }).catch(function (err) {
        alert('Could not read that .docx file: ' + err.message);
      });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  });

  document.getElementById('btnNarrowToggle').addEventListener('click', function () {
    const pane = document.getElementById('previewPane');
    pane.classList.toggle('narrow-check');
    this.textContent = pane.classList.contains('narrow-check') ? 'Back to full width' : 'Check narrow width';
  });

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  document.getElementById('btnSample').addEventListener('click', function () {
    mdInput.value = SAMPLE_MD;
    document.getElementById('seoTitle').value = 'Ad Fatigue: How to Spot It Before It Costs You';
    document.getElementById('seoMeta').value = 'Learn the three signals that show a Meta creative has entered fatigue, and when to rotate it before it drains your budget.';
    document.getElementById('seoSlug').value = 'ad-fatigue-how-to-spot-it';
    document.getElementById('seoKeyword').value = 'ad fatigue';
    updatePreview();
    updateWordCount();
    refreshSeoSuggestions();
    saveDraft();
  });

  document.getElementById('btnClear').addEventListener('click', function () {
    if (mdInput.value.trim() && !confirm('Clear the current article? This cannot be undone.')) return;
    mdInput.value = '';
    updatePreview();
    updateWordCount();
    refreshSeoSuggestions();
    HS.storage.remove(DRAFT_KEY);
  });

  document.getElementById('btnAutoFix').addEventListener('click', function () {
    const md = mdInput.value;
    const candidates = HS.engine.getAllFixCandidates(md);
    renderFixPreview(candidates, md);
  });

  function currentExport(format) {
    const md = mdInput.value;
    if (format === 'markdown') return md;
    if (typeof marked === 'undefined') return null; // html/gutenberg/plaintext all need marked
    if (format === 'html') return marked.parse(md);
    if (format === 'gutenberg') return HS.exportFmt.toGutenberg(md);
    if (format === 'plaintext') return HS.exportFmt.toPlainText(md);
    return '';
  }

  document.querySelectorAll('.export-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const content = currentExport(btn.dataset.format);
      if (content === null) {
        document.getElementById('exportPreview').textContent = 'This export needs the marked.js library from jsdelivr.net, which hasn\u2019t loaded — check your connection and reload.';
        return;
      }
      document.getElementById('exportPreview').textContent = content || 'Nothing to export yet — paste an article in the Editor tab.';
      if (content) {
        navigator.clipboard.writeText(content).then(function () {
          const fb = document.getElementById('copyFeedback');
          fb.textContent = 'Copied!';
          setTimeout(() => { fb.textContent = ''; }, 2000);
        }).catch(function () {});
      }
    });
  });

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  document.getElementById('btnDownloadMd').addEventListener('click', function () { downloadFile('article.md', mdInput.value, 'text/markdown'); });
  document.getElementById('btnDownloadHtml').addEventListener('click', function () {
    if (typeof marked === 'undefined') { alert('This needs the marked.js library from jsdelivr.net, which hasn\u2019t loaded — check your connection and reload.'); return; }
    downloadFile('article.html', marked.parse(mdInput.value), 'text/html');
  });

  document.getElementById('btnAddFaq').addEventListener('click', function () {
    faqItems.push({ q: '', a: '' });
    renderFaqList();
    updateFaqPreview();
    saveDraft();
  });
  document.getElementById('faqFormat').addEventListener('change', updateFaqPreview);
  document.getElementById('btnCopyFaq').addEventListener('click', function () {
    const text = document.getElementById('faqPreview').textContent;
    if (!text || text.indexOf('Add at least') === 0) return;
    navigator.clipboard.writeText(text).then(() => HS.util.flashButtonFeedback(this, 'Copied!'));
  });

  document.getElementById('btnGenArticleLd').addEventListener('click', function () {
    const out = HS.exportFmt.articleJsonLd(mdInput.value, currentSeo(), {
      author: document.getElementById('articleAuthor').value.trim(),
      date: document.getElementById('articleDate').value
    });
    document.getElementById('jsonLdPreview').textContent = out;
    navigator.clipboard.writeText(out).then(() => HS.util.flashButtonFeedback(this, 'Copied!'));
  });
  document.getElementById('btnGenBreadcrumbLd').addEventListener('click', function () {
    const out = HS.exportFmt.breadcrumbJsonLd(document.getElementById('breadcrumbPath').value.trim());
    if (!out) { document.getElementById('jsonLdPreview').textContent = 'Enter a breadcrumb path first (e.g. Home > Blog > Category).'; return; }
    document.getElementById('jsonLdPreview').textContent = out;
    navigator.clipboard.writeText(out).then(() => HS.util.flashButtonFeedback(this, 'Copied!'));
  });
  document.getElementById('isHowTo').addEventListener('change', function () {
    document.getElementById('btnGenHowToLd').disabled = !this.checked;
  });
  document.getElementById('btnGenHowToLd').addEventListener('click', function () {
    const out = HS.exportFmt.howToJsonLd(mdInput.value, document.getElementById('seoTitle').value.trim());
    if (!out) { document.getElementById('jsonLdPreview').textContent = 'No numbered list found in the article — add one to generate HowTo steps.'; return; }
    document.getElementById('jsonLdPreview').textContent = out;
    navigator.clipboard.writeText(out).then(() => HS.util.flashButtonFeedback(this, 'Copied!'));
  });

  document.querySelectorAll('.preset-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      HS.settings.applyPreset(btn.dataset.preset);
      populateSettingsForm();
      flashSettingsFeedback('Applied ' + HS.settings.PRESETS[btn.dataset.preset].label);
    });
  });

  document.getElementById('btnSuggestPreset').addEventListener('click', function () {
    const md = mdInput.value;
    const box = document.getElementById('presetSuggestion');
    box.style.display = 'block';

    if (!md.trim()) {
      box.innerHTML = 'Paste an article in the Editor tab first — the suggestion is based on your actual sentence and paragraph length, not a guess.';
      return;
    }
    const result = HS.settings.suggestPreset(md);
    if (!result) {
      box.innerHTML = 'Not enough text yet to suggest a preset.';
      return;
    }
    const preset = HS.settings.PRESETS[result.presetName];
    if (result.presetName === HS.settings.current.presetName) {
      box.innerHTML = `Your draft averages ${result.avgSentenceLen.toFixed(1)} words/sentence and ${result.avgParaLen.toFixed(0)} words/paragraph — that already matches <strong>${preset.label}</strong>, which is active.`;
      return;
    }
    box.innerHTML = `Your draft averages ${result.avgSentenceLen.toFixed(1)} words/sentence and ${result.avgParaLen.toFixed(0)} words/paragraph — closest to <strong>${preset.label}</strong>.<br><button type="button" class="btn-secondary small" id="btnApplySuggestedPreset">Switch to ${HS.util.escapeHtml(preset.label)}</button>`;
    document.getElementById('btnApplySuggestedPreset').addEventListener('click', function () {
      HS.settings.applyPreset(result.presetName);
      populateSettingsForm();
      box.style.display = 'none';
      flashSettingsFeedback('Applied ' + preset.label);
    });
  });

  SETTINGS_FIELD_IDS.forEach(function (id) {
    document.getElementById(id).addEventListener('change', function () {
      HS.settings.current = readSettingsFromForm();
      HS.settings.save(HS.settings.current);
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      flashSettingsFeedback('Saved');
    });
  });

  document.getElementById('btnResetSettings').addEventListener('click', function () {
    HS.settings.resetToDefault();
    populateSettingsForm();
    flashSettingsFeedback('Reset to Default');
  });
});

})();
