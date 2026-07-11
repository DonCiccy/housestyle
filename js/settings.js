/* Housestyle — configurable thresholds (Phase 2).
   Every rule file reads its numeric thresholds from HS.settings.current instead
   of a hardcoded constant. Changing a value here and re-running analysis picks
   it up immediately, since rule functions read HS.settings.current.xxx at call
   time, not at page-load time. */

HS.settings = {};

HS.settings.STORAGE_KEY = 'housestyle-settings-v1';

HS.settings.PRESETS = {
  default: {
    label: 'General / Balanced',
    maxSentenceWarn: 20, maxSentenceCritical: 28,
    maxParagraphWords: 150,
    passiveSuggest: 0.10, passiveWarn: 0.25,
    minHeadingsForToc: 3,
    targetReadingGrade: 9,
    titleIdealMin: 50, titleIdealMax: 60,
    metaIdealMin: 120, metaIdealMax: 158,
    keywordDensityMin: 0.5, keywordDensityMax: 2.5
  },
  concise: {
    label: 'News / Brief',
    maxSentenceWarn: 15, maxSentenceCritical: 22,
    maxParagraphWords: 80,
    passiveSuggest: 0.08, passiveWarn: 0.20,
    minHeadingsForToc: 2,
    targetReadingGrade: 7,
    titleIdealMin: 40, titleIdealMax: 55,
    metaIdealMin: 90, metaIdealMax: 120,
    keywordDensityMin: 0.5, keywordDensityMax: 3.0
  },
  longform: {
    label: 'In-depth / Feature',
    maxSentenceWarn: 25, maxSentenceCritical: 35,
    maxParagraphWords: 200,
    passiveSuggest: 0.15, passiveWarn: 0.30,
    minHeadingsForToc: 4,
    targetReadingGrade: 11,
    titleIdealMin: 50, titleIdealMax: 70,
    metaIdealMin: 120, metaIdealMax: 160,
    keywordDensityMin: 0.3, keywordDensityMax: 2.0
  },
  explainer: {
    label: 'Explainer / Popular Science',
    maxSentenceWarn: 16, maxSentenceCritical: 24,
    maxParagraphWords: 110,
    passiveSuggest: 0.08, passiveWarn: 0.20,
    minHeadingsForToc: 3,
    targetReadingGrade: 7,
    titleIdealMin: 45, titleIdealMax: 60,
    metaIdealMin: 110, metaIdealMax: 150,
    keywordDensityMin: 0.3, keywordDensityMax: 2.0
  }
};

/* Title/meta "acceptable" (warning-tier) bands are derived from the ideal
   band automatically, rather than exposed as separate settings — keeps the
   Settings tab to ~11 numbers instead of ~19 for the same practical control. */
HS.settings.TITLE_PAD = 15;
HS.settings.META_PAD = 20;

/* Settings that describe editorial *policy* rather than writing style, so
   they don't vary by preset and aren't touched when switching between them —
   same reasoning as disabledChecks/avoidPhrases/customFillerWords. 0 for
   minWordCount/maxWordCount means "no limit", so the length check simply
   doesn't exist until at least one bound is set. */
HS.settings.POLICY_DEFAULTS = {
  minWordCount: 0,
  maxWordCount: 0,
  requiredHeadingPatterns: [],
  readyThreshold: 80
};

HS.settings.load = function () {
  const base = Object.assign({ disabledChecks: [], avoidPhrases: [], customFillerWords: [] }, HS.settings.POLICY_DEFAULTS, HS.settings.PRESETS.default);
  const stored = HS.storage.get(HS.settings.STORAGE_KEY, null);
  if (stored && typeof stored === 'object') {
    // merge over defaults so a future new field never ends up undefined for
    // someone who saved settings before that field existed
    return Object.assign({}, base, stored);
  }
  return base;
};

HS.settings.save = function (settings) {
  HS.storage.set(HS.settings.STORAGE_KEY, settings);
};

HS.settings.current = HS.settings.load();

/* Applying a preset only changes the numeric thresholds. Which checks are
   enabled, custom word lists, and editorial-policy settings (length limits,
   required headings, the publish-ready threshold) are a different axis of
   control ("what matters to me" vs "how strict is the tuning") and survive
   a preset switch. */
HS.settings.applyPreset = function (name) {
  const preset = HS.settings.PRESETS[name];
  if (!preset) return;
  const keep = {};
  Object.keys(HS.settings.POLICY_DEFAULTS).forEach(function (k) { keep[k] = HS.settings.current[k]; });
  HS.settings.current = Object.assign(
    { presetName: name,
      disabledChecks: HS.settings.current.disabledChecks || [],
      avoidPhrases: HS.settings.current.avoidPhrases || [],
      customFillerWords: HS.settings.current.customFillerWords || [] },
    keep,
    preset
  );
  HS.settings.save(HS.settings.current);
};

HS.settings.resetToDefault = function () {
  HS.settings.applyPreset('default');
};

/* Every *always-present* check, for the "turn checks on/off" UI in Settings.
   Hand-maintained rather than derived from running the rules, so the list
   stays obvious to read — keep this in sync if a rule's id/title changes in
   js/rules/*.js. Checks that only exist once configured (avoid-phrases,
   required headings, article length) aren't listed here on purpose — if you
   don't want them, you simply don't set them up, no separate toggle needed. */
HS.settings.ALL_CHECKS = [
  { id: 'structure-single-h1', title: 'Single H1', category: 'structure' },
  { id: 'structure-empty-headings', title: 'No empty headings', category: 'structure' },
  { id: 'structure-skipped-levels', title: 'No skipped heading levels', category: 'structure' },
  { id: 'structure-duplicate-h2', title: 'No duplicated H2s', category: 'structure' },
  { id: 'structure-toc-ready', title: 'Table of contents available', category: 'structure' },
  { id: 'readability-sentence-length', title: 'Average sentence length', category: 'readability' },
  { id: 'readability-paragraph-length', title: 'Paragraph length', category: 'readability' },
  { id: 'readability-grade-level', title: 'Reading grade level', category: 'readability' },
  { id: 'readability-passive-voice', title: 'Passive voice', category: 'readability' },
  { id: 'readability-repeated-words', title: 'Repeated words', category: 'readability' },
  { id: 'readability-filler-words', title: 'Filler words', category: 'readability' },
  { id: 'readability-transition-words', title: 'Transition words', category: 'readability' },
  { id: 'formatting-double-spaces', title: 'Double spaces', category: 'formatting' },
  { id: 'formatting-blank-lines', title: 'Multiple blank lines', category: 'formatting' },
  { id: 'formatting-broken-lists', title: 'Broken lists', category: 'formatting' },
  { id: 'formatting-malformed-links', title: 'Malformed links', category: 'formatting' },
  { id: 'formatting-quote-style', title: 'Quote style', category: 'formatting' },
  { id: 'formatting-multi-punct', title: 'Multiple punctuation', category: 'formatting' },
  { id: 'formatting-trailing-spaces', title: 'Trailing spaces', category: 'formatting' },
  { id: 'seo-title-length', title: 'SEO title length', category: 'seo' },
  { id: 'seo-meta-length', title: 'Meta description length', category: 'seo' },
  { id: 'seo-slug-format', title: 'Slug format', category: 'seo' },
  { id: 'seo-keyword-density', title: 'Keyword density', category: 'seo' },
  { id: 'seo-keyword-in-heading', title: 'Keyword in a heading', category: 'seo' },
  { id: 'seo-image-alt', title: 'Image ALT coverage', category: 'seo' },
  { id: 'seo-link-presence', title: 'Outbound / internal links', category: 'seo' },
  { id: 'a11y-missing-alt', title: 'Missing ALT text', category: 'accessibility' },
  { id: 'a11y-empty-links', title: 'Empty links', category: 'accessibility' },
  { id: 'a11y-heading-order', title: 'Heading order', category: 'accessibility' },
  { id: 'a11y-paragraph-length', title: 'Paragraph length', category: 'accessibility' }
];

/* Recommends a preset from the article's *actual* sentence/paragraph length,
   not from self-reported intentions — a "suggest" mechanism that shows its
   work (the real numbers) instead of a wizard whose mapping from a few
   multiple-choice answers to a dozen thresholds would just be invented. */
HS.settings.suggestPreset = function (md) {
  const util = HS.util;
  const plain = util.stripMarkdown(md);
  const words = util.getWords(plain);
  const sentences = util.getSentences(plain);
  const paragraphs = util.getMarkdownParagraphBlocks(md);
  if (!words.length || !sentences.length) return null;

  const avgSentenceLen = words.length / sentences.length;
  const paraWordCounts = paragraphs.map(p => util.getWords(util.stripMarkdown(p)).length);
  const avgParaLen = paraWordCounts.length ? paraWordCounts.reduce((a, b) => a + b, 0) / paraWordCounts.length : avgSentenceLen * 5;

  let best = null, bestDist = Infinity;
  Object.keys(HS.settings.PRESETS).forEach(function (key) {
    const p = HS.settings.PRESETS[key];
    const sentDist = Math.abs(avgSentenceLen - p.maxSentenceWarn) / p.maxSentenceWarn;
    const paraDist = Math.abs(avgParaLen - p.maxParagraphWords) / p.maxParagraphWords;
    const dist = sentDist + paraDist;
    if (dist < bestDist) { bestDist = dist; best = key; }
  });

  return { presetName: best, avgSentenceLen: avgSentenceLen, avgParaLen: avgParaLen };
};

/* Numeric fields validated on import — anything missing, non-numeric, or
   hand-edited into nonsense falls back to the current value rather than
   leaving a NaN threshold silently broken. */
HS.settings.NUMERIC_KEYS = ['maxSentenceWarn','maxSentenceCritical','maxParagraphWords','passiveSuggest','passiveWarn',
  'targetReadingGrade','minHeadingsForToc','titleIdealMin','titleIdealMax','metaIdealMin','metaIdealMax',
  'keywordDensityMin','keywordDensityMax','minWordCount','maxWordCount','readyThreshold'];
HS.settings.ARRAY_KEYS = ['disabledChecks','customFillerWords','requiredHeadingPatterns','avoidPhrases'];

/* Everything in HS.settings.current is editorial standard today — thresholds,
   enabled checks, word lists, editorial policy — nothing device-specific has
   ever been added to it, so the export is simply that object plus a name and
   a timestamp so a team can tell whether they're looking at the current
   version or an older one someone forgot to re-import. */
HS.settings.exportProfile = function (name) {
  return {
    name: (name || 'Untitled profile').trim(),
    exportedAt: new Date().toISOString(),
    housestyleProfileVersion: 1,
    settings: HS.settings.current
  };
};

/* Accepts either the full { name, exportedAt, settings } wrapper or a bare
   settings object (in case someone hand-edits or shares just the inner
   part), merges it over the currently-loaded settings so any field the file
   doesn't have keeps its current value, and coerces known fields to the
   right type instead of trusting the file blindly. Returns null if the input
   isn't shaped like a profile at all. */
HS.settings.sanitizeImported = function (raw) {
  if (!raw || typeof raw !== 'object') return null;
  const incoming = (raw.settings && typeof raw.settings === 'object') ? raw.settings : raw;
  if (typeof incoming !== 'object') return null;

  const merged = Object.assign({}, HS.settings.current, incoming);

  HS.settings.NUMERIC_KEYS.forEach(function (k) {
    const val = parseFloat(merged[k]);
    merged[k] = isNaN(val) ? HS.settings.current[k] : val;
  });
  HS.settings.ARRAY_KEYS.forEach(function (k) {
    if (!Array.isArray(merged[k])) merged[k] = HS.settings.current[k] || [];
  });
  if (typeof merged.presetName !== 'string') merged.presetName = 'custom';

  return { name: typeof raw.name === 'string' ? raw.name : null, settings: merged };
};
