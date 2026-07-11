/* Housestyle — Readability rules.
   Sentence length, word length and transition-word ratio are document-level
   averages: there's no single character to point at, so location stays 'none'.
   Paragraph length, passive voice, filler words and repeated words each have
   real positions — computed against the *original* Markdown (not the stripped
   plain text) so the offsets line up with what's actually in the textarea.
   Thresholds come from HS.settings.current, read at call time, so changing a
   setting and re-running analysis picks it up immediately. */

const FILLER_WORDS = ['basically','actually','just','really','very','quite','rather','somewhat','essentially','literally','simply','definitely','certainly','generally','virtually','practically','honestly','totally','absolutely'];
const TRANSITION_WORDS = ['however','therefore','moreover','furthermore','additionally','consequently','meanwhile','nevertheless','nonetheless','thus','hence','accordingly','similarly','likewise','otherwise','instead','indeed','finally','first','second','third','next','then','also','besides','still','yet','although','because','since','unless','while','for example','for instance','in fact','as a result','in contrast','on the other hand','in conclusion'];
const IRREGULAR_PARTICIPLES = ['done','made','given','taken','written','seen','known','shown','found','told','said','held','brought','bought','caught','taught','sent','spent','built','sold','thought','kept','left','meant','felt','heard','read','run','put','cut','hit','set','begun','broken','chosen','driven','eaten','fallen','forgotten','frozen','gotten','hidden','ridden','risen','spoken','stolen','stood','sworn','torn','worn','won'];

/* Standard heuristic syllable counter (the same approach used by most
   web-based readability tools — there's no dictionary, so this is an
   approximation, not a guarantee, same spirit as the passive-voice check). */
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}
const PASSIVE_RE = new RegExp('\\b(am|is|are|was|were|be|been|being)\\s+(\\w+ed|' + IRREGULAR_PARTICIPLES.join('|') + ')\\b', 'gi');

HS.rules.readability = function (md) {
  const R = [];
  const mk = HS.util.makeResult;
  const util = HS.util;
  const cfg = HS.settings.current;

  const plain = util.stripMarkdown(md);
  const words = util.getWords(plain);
  const sentences = util.getSentences(plain);
  const paragraphs = util.getMarkdownParagraphBlocks(md);

  if (words.length === 0) return R;

  // Average sentence length — aggregate
  const avgSentenceLen = sentences.length ? words.length / sentences.length : 0;
  R.push(mk({
    id: 'readability-sentence-length', category: 'readability', title: 'Average sentence length',
    severity: avgSentenceLen <= cfg.maxSentenceWarn ? 'pass' : avgSentenceLen <= cfg.maxSentenceCritical ? 'warning' : 'critical',
    detail: `${avgSentenceLen.toFixed(1)} words/sentence — aim for ${cfg.maxSentenceWarn} or fewer.`,
    location: { type: 'none' }, fixable: false
  }));

  // Paragraph length — every over-length paragraph gets a navigable position
  const longParaLocations = [];
  let searchFrom = 0;
  paragraphs.forEach(function (p) {
    const wc = util.getWords(util.stripMarkdown(p)).length;
    const idx = md.indexOf(p, searchFrom);
    if (wc > cfg.maxParagraphWords && idx >= 0) longParaLocations.push({ start: idx, end: idx + p.length });
    if (idx >= 0) searchFrom = idx + p.length;
  });
  R.push(mk({
    id: 'readability-paragraph-length', category: 'readability', title: 'Paragraph length',
    severity: longParaLocations.length === 0 ? 'pass' : longParaLocations.length <= 2 ? 'warning' : 'critical',
    detail: longParaLocations.length === 0 ? `No paragraph exceeds ${cfg.maxParagraphWords} words.` : `${longParaLocations.length} paragraph(s) exceed ${cfg.maxParagraphWords} words — consider splitting them.`,
    location: longParaLocations.length ? { type: 'text', start: longParaLocations[0].start, end: longParaLocations[0].end } : { type: 'none' },
    locations: longParaLocations.length ? longParaLocations : null,
    fixable: false
  }));

  // Reading grade level (Flesch-Kincaid) — aggregate. Approximates the US
  // school grade needed to follow the text on first read; lower is simpler.
  // Only ever a problem when the text is *harder* than the target — writing
  // simpler than intended isn't penalized.
  const totalSyllables = words.reduce(function (sum, w) { return sum + countSyllables(w); }, 0);
  const gradeLevel = sentences.length && words.length
    ? Math.max(0, 0.39 * (words.length / sentences.length) + 11.8 * (totalSyllables / words.length) - 15.59)
    : 0;
  R.push(mk({
    id: 'readability-grade-level', category: 'readability', title: 'Reading grade level',
    severity: gradeLevel <= cfg.targetReadingGrade ? 'pass' : gradeLevel <= cfg.targetReadingGrade + 3 ? 'warning' : 'critical',
    detail: `Flesch-Kincaid grade \u2248 ${gradeLevel.toFixed(1)} — target is ${cfg.targetReadingGrade} or below. Estimated from sentence and word length, not a dictionary — a guide, not a verdict.`,
    location: { type: 'none' }, fixable: false
  }));

  // Passive voice — every match gets a navigable position
  const passiveMatches = [...md.matchAll(PASSIVE_RE)];
  const passiveLocations = util.locationsFromMatches(passiveMatches);
  const passiveRatio = sentences.length ? passiveMatches.length / sentences.length : 0;
  R.push(mk({
    id: 'readability-passive-voice', category: 'readability', title: 'Passive voice (rule-based)',
    severity: passiveRatio <= cfg.passiveSuggest ? 'pass' : passiveRatio <= cfg.passiveWarn ? 'suggestion' : 'warning',
    detail: `${passiveMatches.length} likely passive construction(s) in ${sentences.length} sentence(s). Heuristic — always double-check by eye.`,
    location: passiveLocations.length ? { type: 'text', start: passiveLocations[0].start, end: passiveLocations[0].end } : { type: 'none' },
    locations: passiveLocations.length ? passiveLocations : null,
    fixable: false
  }));

  // Repeated words (back-to-back) — every repeat gets a navigable position
  const wordTokens = [...md.matchAll(/\b[a-zA-Z']+\b/g)];
  const repeatLocations = [];
  for (let i = 1; i < wordTokens.length; i++) {
    const prev = wordTokens[i - 1][0].toLowerCase();
    const cur = wordTokens[i][0].toLowerCase();
    if (prev === cur) {
      const m = wordTokens[i - 1];
      repeatLocations.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  R.push(mk({
    id: 'readability-repeated-words', category: 'readability', title: 'Repeated words',
    severity: repeatLocations.length === 0 ? 'pass' : 'suggestion',
    detail: repeatLocations.length === 0 ? 'No immediately repeated words.' : `${repeatLocations.length} word(s) repeated back-to-back. Auto-Fix can remove the duplicates.`,
    location: repeatLocations.length ? { type: 'text', start: repeatLocations[0].start, end: repeatLocations[0].end } : { type: 'none' },
    locations: repeatLocations.length ? repeatLocations : null,
    fixable: repeatLocations.length > 0
  }));

  // Filler words — built-in list plus anything the user added in Settings
  const customFiller = (cfg.customFillerWords || []).filter(Boolean);
  const allFillerWords = FILLER_WORDS.concat(customFiller);
  const fillerRe = new RegExp('\\b(' + allFillerWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
  const fillerMatches = [...md.matchAll(fillerRe)];
  const fillerLocations = util.locationsFromMatches(fillerMatches);
  const fillerRatio = fillerMatches.length / words.length;
  R.push(mk({
    id: 'readability-filler-words', category: 'readability', title: 'Filler words',
    severity: fillerRatio <= 0.01 ? 'pass' : fillerRatio <= 0.025 ? 'suggestion' : 'warning',
    detail: `${fillerMatches.length} filler word(s) (e.g. "basically", "just", "really"${customFiller.length ? ', plus your own list' : ''}) in ${words.length} words.`,
    location: fillerLocations.length ? { type: 'text', start: fillerLocations[0].start, end: fillerLocations[0].end } : { type: 'none' },
    locations: fillerLocations.length ? fillerLocations : null,
    fixable: false
  }));

  // Words/phrases to avoid — entirely user-defined, empty by default. Doesn't
  // exist as a check at all until someone adds terms in Settings, so it never
  // clutters Problems for the vast majority who never touch it.
  const avoidEntries = util.normalizeAvoidPhrases(cfg.avoidPhrases);
  if (avoidEntries.length) {
    const avoidRe = new RegExp('\\b(' + avoidEntries.map(e => e.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'gi');
    const avoidMatches = [...md.matchAll(avoidRe)];
    const avoidLocations = util.locationsFromMatches(avoidMatches);
    const hasAnyReplacement = avoidEntries.some(e => e.replacement);
    R.push(mk({
      id: 'readability-avoid-phrases', category: 'readability', title: 'Words/phrases to avoid',
      severity: avoidLocations.length === 0 ? 'pass' : 'warning',
      detail: avoidLocations.length === 0 ? `None of your ${avoidEntries.length} avoid-list term(s) found.` : `${avoidLocations.length} instance(s) of terms on your avoid list${hasAnyReplacement ? ' — some have a one-click replacement in Auto-Fix' : ''}.`,
      location: avoidLocations.length ? { type: 'text', start: avoidLocations[0].start, end: avoidLocations[0].end } : { type: 'none' },
      locations: avoidLocations.length ? avoidLocations : null,
      fixable: hasAnyReplacement
    }));
  }

  // Transition words — aggregate
  const transitionSentences = sentences.filter(s => {
    const low = s.toLowerCase();
    return TRANSITION_WORDS.some(t => low.includes(t));
  }).length;
  const transitionRatio = sentences.length ? transitionSentences / sentences.length : 0;
  R.push(mk({
    id: 'readability-transition-words', category: 'readability', title: 'Transition words',
    severity: transitionRatio >= 0.25 ? 'pass' : 'suggestion',
    detail: `${Math.round(transitionRatio * 100)}% of sentences use a transition word — aim for 25%+.`,
    location: { type: 'none' }, fixable: false
  }));

  return R;
};

/* Granular Auto-Fix candidates for readability. Two sources: a back-to-back
   doubled word ("the the") is almost always a typo, safe to propose with
   high confidence; and any user-defined avoid-phrase that came with a
   replacement ("Facebook Ads -> Meta Ads" in Settings) is a plain find/replace
   the user explicitly asked for, equally safe. Sentence length, passive
   voice, filler words and transition words all need an actual rewrite to
   fix — that changes meaning and voice, editorial judgment this doesn't
   offer even as a one-click suggestion. */
HS.rules.getReadabilityFixCandidates = function (md) {
  const raw = [];

  const wordTokens = [...md.matchAll(/\b[a-zA-Z']+\b/g)];
  for (let i = 1; i < wordTokens.length; i++) {
    const prev = wordTokens[i - 1];
    const cur = wordTokens[i];
    if (prev[0].toLowerCase() === cur[0].toLowerCase()) {
      raw.push({
        category: 'Repeated word',
        start: prev.index,
        end: cur.index + cur[0].length,
        before: md.slice(prev.index, cur.index + cur[0].length),
        after: prev[0]
      });
    }
  }

  const avoidEntries = HS.util.normalizeAvoidPhrases(HS.settings.current.avoidPhrases).filter(function (e) { return e.replacement; });
  avoidEntries.forEach(function (e) {
    const re = new RegExp('\\b(' + e.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')\\b', 'gi');
    [...md.matchAll(re)].forEach(function (m) {
      raw.push({ category: 'Avoid list: "' + e.term + '"', start: m.index, end: m.index + m[0].length, before: m[0], after: e.replacement });
    });
  });

  return HS.util.resolveOverlappingCandidates(raw);
};
