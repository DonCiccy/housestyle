/* Housestyle — Structure rules. */

/* Shared by the check below and getStructureFixCandidates, so detection and
   fixability can never drift apart. Walks headings in document order,
   tracking the *effective* (possibly already-corrected) previous level
   rather than the raw one — a heading only counts as skipped relative to
   what its predecessor will actually be after earlier fixes in the same
   pass, so a chain like H1 -> H4 -> H5 resolves to H1 -> H2 -> H3 instead of
   H1 -> H2 -> (still broken). Returns one entry per skip: the regex match
   plus the corrected level it should become. */
HS.rules._findHeadingSkips = function (headingMatches) {
  const skips = [];
  let effectivePrev = 0;
  headingMatches.forEach(function (h) {
    const originalLevel = h[1].length;
    let effectiveLevel = originalLevel;
    if (effectivePrev > 0 && originalLevel > effectivePrev + 1) {
      effectiveLevel = effectivePrev + 1;
      skips.push({ match: h, fixedLevel: effectiveLevel });
    }
    effectivePrev = effectiveLevel;
  });
  return skips;
};

HS.rules.structure = function (md) {
  const R = [];
  const mk = HS.util.makeResult;
  const cfg = HS.settings.current;
  const headingMatches = [...md.matchAll(/^(#{1,6})[ \t]*(.*)$/gm)];

  // Single H1 — every H1 beyond the first is a navigable "extra" location
  const h1s = headingMatches.filter(h => h[1].length === 1);
  const extraH1Locations = h1s.slice(1).map(h => ({ start: h.index, end: h.index + h[0].length }));
  R.push(mk({
    id: 'structure-single-h1', category: 'structure', title: 'Single H1',
    severity: h1s.length === 1 ? 'pass' : 'critical',
    detail: h1s.length === 1 ? 'Exactly one H1 found.' : h1s.length === 0 ? 'No H1 found — add one title heading.' : `${h1s.length} H1s found — keep only one. Auto-Fix can demote the extras to H2.`,
    location: extraH1Locations.length ? { type: 'text', start: extraH1Locations[0].start, end: extraH1Locations[0].end } : { type: 'none' },
    locations: extraH1Locations.length ? extraH1Locations : null,
    fixable: extraH1Locations.length > 0
  }));

  // No empty headings — every empty heading is navigable
  const emptyLocations = headingMatches.filter(h => !h[2] || !h[2].trim()).map(h => ({ start: h.index, end: h.index + h[0].length }));
  R.push(mk({
    id: 'structure-empty-headings', category: 'structure', title: 'No empty headings',
    severity: emptyLocations.length === 0 ? 'pass' : 'critical',
    detail: emptyLocations.length === 0 ? 'All headings have text.' : `${emptyLocations.length} empty heading(s) found. Auto-Fix can remove them.`,
    location: emptyLocations.length ? { type: 'text', start: emptyLocations[0].start, end: emptyLocations[0].end } : { type: 'none' },
    locations: emptyLocations.length ? emptyLocations : null,
    fixable: emptyLocations.length > 0
  }));

  // No skipped heading levels — every jump point is navigable
  const skips = HS.rules._findHeadingSkips(headingMatches);
  const skipLocations = skips.map(function (s) { return { start: s.match.index, end: s.match.index + s.match[0].length }; });
  R.push(mk({
    id: 'structure-skipped-levels', category: 'structure', title: 'No skipped heading levels',
    severity: skipLocations.length ? 'warning' : 'pass',
    detail: skipLocations.length ? 'A heading jumps more than one level down (e.g. H2 to H4) — screen readers rely on the sequence. Auto-Fix can adjust the level.' : 'Heading levels step down one at a time.',
    location: skipLocations.length ? { type: 'text', start: skipLocations[0].start, end: skipLocations[0].end } : { type: 'none' },
    locations: skipLocations.length ? skipLocations : null,
    fixable: skipLocations.length > 0
  }));

  // No duplicated H2s — every repeat occurrence (not the first) is navigable
  const h2s = headingMatches.filter(h => h[1].length === 2);
  const seenH2 = new Set();
  const dupLocations = [];
  let dupText = null;
  for (const h of h2s) {
    const t = h[2].trim().toLowerCase();
    if (t && seenH2.has(t)) {
      dupLocations.push({ start: h.index, end: h.index + h[0].length });
      if (!dupText) dupText = h[2].trim();
    }
    seenH2.add(t);
  }
  R.push(mk({
    id: 'structure-duplicate-h2', category: 'structure', title: 'No duplicated H2s',
    severity: dupLocations.length ? 'warning' : 'pass',
    detail: dupLocations.length ? `Repeated H2 text: "${dupText}".` : 'No repeated H2 text.',
    location: dupLocations.length ? { type: 'text', start: dupLocations[0].start, end: dupLocations[0].end } : { type: 'none' },
    locations: dupLocations.length ? dupLocations : null,
    fixable: false
  }));

  // Table of contents availability (aggregate — no single position)
  R.push(mk({
    id: 'structure-toc-ready', category: 'structure', title: 'Table of contents available',
    severity: headingMatches.length >= cfg.minHeadingsForToc ? 'pass' : 'suggestion',
    detail: headingMatches.length >= cfg.minHeadingsForToc ? `${headingMatches.length} headings — enough structure for a TOC.` : `Fewer than ${cfg.minHeadingsForToc} headings — a TOC won\u2019t add much value yet.`,
    location: { type: 'none' },
    fixable: false
  }));

  // Article length — an editorial policy setting, not a writing-style one.
  // 0 means "no limit"; the check doesn't exist unless at least one bound is set.
  if (cfg.minWordCount > 0 || cfg.maxWordCount > 0) {
    const wc = HS.util.getWords(HS.util.stripMarkdown(md)).length;
    let lengthSeverity = 'pass';
    let lengthDetail = `${wc} words.`;
    if (cfg.minWordCount > 0 && wc < cfg.minWordCount) {
      lengthSeverity = 'critical';
      lengthDetail = `${wc} words — below the ${cfg.minWordCount}-word minimum.`;
    } else if (cfg.maxWordCount > 0 && wc > cfg.maxWordCount) {
      lengthSeverity = 'critical';
      lengthDetail = `${wc} words — above the ${cfg.maxWordCount}-word maximum.`;
    } else {
      const range = (cfg.minWordCount || '0') + '\u2013' + (cfg.maxWordCount || '\u221E');
      lengthDetail = `${wc} words — within the ${range} target range.`;
    }
    R.push(mk({
      id: 'structure-word-count', category: 'structure', title: 'Article length',
      severity: lengthSeverity, detail: lengthDetail,
      location: { type: 'none' }, fixable: false
    }));
  }

  // Required heading sections — user-defined editorial policy, e.g. "every
  // article must have a heading mentioning Sources". Pure substring matching
  // against text the user wrote themselves, so there's no ambiguity the way
  // there would be trying to detect "does this have a CTA" heuristically.
  const requiredPatterns = (cfg.requiredHeadingPatterns || []).map(function (p) { return String(p).trim(); }).filter(Boolean);
  if (requiredPatterns.length) {
    const headingTextBlob = headingMatches.map(function (h) { return (h[2] || '').toLowerCase(); }).join(' \u2022 ');
    const missing = requiredPatterns.filter(function (p) { return headingTextBlob.indexOf(p.toLowerCase()) === -1; });
    R.push(mk({
      id: 'structure-required-headings', category: 'structure', title: 'Required heading sections',
      severity: missing.length === 0 ? 'pass' : 'critical',
      detail: missing.length === 0 ? `All ${requiredPatterns.length} required heading pattern(s) found.` : `Missing heading(s) containing: ${missing.map(function (m) { return '"' + m + '"'; }).join(', ')}.`,
      location: { type: 'none' }, fixable: false
    }));
  }

  return R;
};

/* Granular Auto-Fix candidates for structure. Both of these are genuinely
   safe, one-click-worthy actions — everything else in Structure (which H1 to
   keep the *content* of when there are two, what a duplicate H2 should be
   renamed to, whether a skipped heading level was intentional) needs a human
   to decide, so it stays flag-only. */
HS.rules.getStructureFixCandidates = function (md) {
  const raw = [];
  const headingMatches = [...md.matchAll(/^(#{1,6})[ \t]*(.*)$/gm)];

  // Empty heading -> remove the whole line. Also consumes any blank-line run
  // immediately before/after and collapses it to a single paragraph break,
  // so deleting the heading doesn't leave a stray extra blank line behind —
  // otherwise this fix would need a second Auto-Fix pass to clean up its own
  // side effect.
  headingMatches.forEach(function (h) {
    if (!h[2] || !h[2].trim()) {
      let start = h.index;
      let end = h.index + h[0].length;
      while (start > 0 && md[start - 1] === '\n') start--;
      while (end < md.length && md[end] === '\n') end++;
      const after = (start > 0 && end < md.length) ? '\n\n' : '';
      raw.push({ category: 'Empty heading', start: start, end: end, before: md.slice(start, end), after: after });
    }
  });

  // Extra H1s beyond the first -> demote to H2. Which one stays H1 isn't a
  // judgment call (the first one, by definition of "single H1"); demoting
  // the rest just adds one '#', nothing about the heading text changes.
  const h1s = headingMatches.filter(function (h) { return h[1].length === 1; });
  h1s.slice(1).forEach(function (h) {
    raw.push({ category: 'Extra H1 \u2192 H2', start: h.index, end: h.index + h[0].length, before: h[0], after: '#' + h[0] });
  });

  // Skipped heading level -> clamp to one level below its (possibly
  // already-fixed) predecessor. Same reasoning as the H1 case: this only
  // touches the '#' run, never the heading text, so there's no guess about
  // what the heading should *say* — just where it sits in the hierarchy,
  // which is what the skip warning is actually about.
  HS.rules._findHeadingSkips(headingMatches).forEach(function (s) {
    const marker = s.match[1];
    raw.push({ category: 'Heading level', start: s.match.index, end: s.match.index + marker.length, before: marker, after: '#'.repeat(s.fixedLevel) });
  });

  return HS.util.resolveOverlappingCandidates(raw);
};
