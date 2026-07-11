/* Housestyle — shared namespace + utilities.
   Loaded first, before every other script. No ES modules on purpose:
   classic <script src="..."> tags work over file:// (double-click to open),
   ES module imports are blocked by CORS in that same scenario. */

window.HS = window.HS || {};
HS.rules = {}; // each rules/*.js file attaches its check function here

HS.storage = {
  get: function (key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  },
  set: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false; // private browsing, storage full, or disabled — fail quietly
    }
  },
  remove: function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
};

HS.util = {
  debounce: function (fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  },

  escapeHtml: function (str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  slugify: function (str) {
    return String(str)
      .toLowerCase()
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');
  },

  stripMarkdown: function (md) {
    return String(md)
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`{1,3}[^`]*?`{1,3}/g, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^-{3,}\s*$|^\*{3,}\s*$/gm, '')
      .trim();
  },

  getWords: function (plainText) {
    return plainText.split(/\s+/).map(w => w.trim()).filter(Boolean);
  },

  getSentences: function (plainText) {
    return plainText.split(/(?<=[.!?])\s+(?=[A-Z0-9])|(?<=[.!?])\n+/)
      .map(s => s.trim()).filter(Boolean);
  },

  getMarkdownParagraphBlocks: function (md) {
    return String(md).split(/\n\s*\n/)
      .map(b => b.trim())
      .filter(Boolean)
      .filter(b => !/^#{1,6}\s/.test(b) && !/^[-*+]\s/.test(b) && !/^\d+\.\s/.test(b) && !/^>/.test(b) && !/^```/.test(b) && !/^!\[/.test(b));
  },

  flashButtonFeedback: function (btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(function () { btn.textContent = original; }, 2000);
  },

  /* Human-readable context around a text location, for the Problems Panel.
     Collapses newlines so it renders on one line; truncates with an ellipsis
     when there's more text before/after than the context window shows. */
  textSnippet: function (md, start, end, contextChars) {
    contextChars = contextChars || 34;
    const clean = function (s) { return s.replace(/\s+/g, ' '); };
    const before = md.slice(Math.max(0, start - contextChars), start);
    const match = md.slice(start, end);
    const after = md.slice(end, Math.min(md.length, end + contextChars));
    return {
      before: (start > contextChars ? '…' : '') + clean(before),
      match: clean(match),
      after: clean(after) + (end + contextChars < md.length ? '…' : '')
    };
  },

  /* Rule factory — every rule module builds its results through this so the
     shape is always consistent: { id, category, severity, title, detail, location, locations, fixable }
     location is one of:
       { type: 'text', start, end }   -> a specific span in the Markdown source
       { type: 'field', id }          -> an input/textarea elsewhere on the page (e.g. SEO fields)
       { type: 'none' }               -> a document-level / aggregate property, nothing to jump to
     locations (optional) is a [{start,end}, ...] array covering every occurrence,
     for checks where more than one instance is worth navigating to individually. */
  makeResult: function (opts) {
    return {
      id: opts.id,
      category: opts.category,
      severity: opts.severity, // 'critical' | 'warning' | 'suggestion' | 'pass'
      title: opts.title,
      detail: opts.detail,
      location: opts.location || { type: 'none' },
      locations: opts.locations || null,
      fixable: !!opts.fixable
    };
  },

  /* Turns a matchAll() result into a plain [{start,end}, ...] array. */
  locationsFromMatches: function (matches) {
    return matches.map(function (m) { return { start: m.index, end: m.index + m[0].length }; });
  },

  /* Shared by every getXFixCandidates() function (formatting.js, readability.js,
     structure.js) and by the final cross-file merge in rule-engine.js. Takes
     raw { category, start, end, before, after } candidates (no id needed),
     sorts by position, greedily keeps the first of any overlapping group —
     stable sort means an earlier entry in the input wins a tie at the same
     start position, which is how "trailing spaces" beats "double spaces" for
     the same trailing run, and "quote pair" beats "apostrophe" for one inside
     a quote — then assigns final sequential ids. */
  resolveOverlappingCandidates: function (rawCandidates) {
    const sorted = rawCandidates.slice().sort(function (a, b) {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start); // same start: longer (more complete) span wins
    });
    const kept = [];
    let lastEnd = -1;
    sorted.forEach(function (c) {
      if (c.start >= lastEnd) { kept.push(c); lastEnd = c.end; }
    });
    kept.forEach(function (c, i) { c.id = 'fix-' + i; });
    return kept;
  },

  /* Normalizes the "words to avoid" setting to { term, replacement } objects.
     Accepts plain strings too (replacement: null) for anyone who saved this
     list before the optional-replacement syntax existed. */
  normalizeAvoidPhrases: function (list) {
    return (list || []).map(function (item) {
      if (typeof item === 'string') return { term: item.trim(), replacement: null };
      if (item && typeof item === 'object' && item.term) return { term: String(item.term).trim(), replacement: item.replacement ? String(item.replacement).trim() : null };
      return null;
    }).filter(function (e) { return e && e.term; });
  }
};

/* Script-tag string helpers, so no literal "</script>" ever sits inside this
   file's own <script> block (that would terminate parsing early in the HTML). */
HS.util.SCRIPT_OPEN = '<script type="application/ld+json">\n';
HS.util.SCRIPT_CLOSE = '\n<' + '/script>';
