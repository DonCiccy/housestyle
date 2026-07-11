/* Housestyle — Formatting rules.
   No configurable thresholds here — these are boolean "is this broken" checks,
   not tunable targets, so nothing to expose in Settings. Every check reports
   the full set of occurrences via `locations`, not just the first. */

HS.rules.formatting = function (md) {
  const R = [];
  const mk = HS.util.makeResult;
  const util = HS.util;

  // Double spaces
  const dsLocations = util.locationsFromMatches([...md.matchAll(/ {2,}/g)]);
  R.push(mk({
    id: 'formatting-double-spaces', category: 'formatting', title: 'Double spaces',
    severity: dsLocations.length === 0 ? 'pass' : 'warning',
    detail: dsLocations.length === 0 ? 'None found.' : `${dsLocations.length} instance(s) found.`,
    location: dsLocations.length ? { type: 'text', start: dsLocations[0].start, end: dsLocations[0].end } : { type: 'none' },
    locations: dsLocations.length ? dsLocations : null,
    fixable: dsLocations.length > 0
  }));

  // Multiple blank lines
  const blankLocations = util.locationsFromMatches([...md.matchAll(/\n{3,}/g)]);
  R.push(mk({
    id: 'formatting-blank-lines', category: 'formatting', title: 'Multiple blank lines',
    severity: blankLocations.length === 0 ? 'pass' : 'warning',
    detail: blankLocations.length === 0 ? 'None found.' : `${blankLocations.length} run(s) of 3+ blank lines.`,
    location: blankLocations.length ? { type: 'text', start: blankLocations[0].start, end: blankLocations[0].end } : { type: 'none' },
    locations: blankLocations.length ? blankLocations : null,
    fixable: blankLocations.length > 0
  }));

  // Broken list markers (marker not followed by a space)
  const brokenLocations = util.locationsFromMatches([...md.matchAll(/^([-*+])(\S)/gm)]);
  R.push(mk({
    id: 'formatting-broken-lists', category: 'formatting', title: 'Broken lists',
    severity: brokenLocations.length === 0 ? 'pass' : 'critical',
    detail: brokenLocations.length === 0 ? 'List markers look correctly spaced.' : `${brokenLocations.length} list marker(s) missing a space after - / * / +.`,
    location: brokenLocations.length ? { type: 'text', start: brokenLocations[0].start, end: brokenLocations[0].end } : { type: 'none' },
    locations: brokenLocations.length ? brokenLocations : null,
    fixable: brokenLocations.length > 0
  }));

  // Malformed / empty links — check every [text] bracket pair individually
  const bracketMatches = [...md.matchAll(/\[[^\]]*\]/g)];
  let malformedCount = 0, emptyCount = 0;
  const badLinkLocations = [];
  bracketMatches.forEach(function (m) {
    const after = md.slice(m.index + m[0].length, m.index + m[0].length + 400);
    const parenMatch = after.match(/^\(([^)]*)\)/);
    if (!parenMatch) { malformedCount++; badLinkLocations.push({ start: m.index, end: m.index + m[0].length }); return; }
    if (!parenMatch[1].trim()) { emptyCount++; badLinkLocations.push({ start: m.index, end: m.index + m[0].length }); }
  });
  R.push(mk({
    id: 'formatting-malformed-links', category: 'formatting', title: 'Malformed links',
    severity: (malformedCount === 0 && emptyCount === 0) ? 'pass' : 'critical',
    detail: (malformedCount === 0 && emptyCount === 0) ? 'All links look well-formed.' : `${malformedCount} malformed and ${emptyCount} empty link(s) found.`,
    location: badLinkLocations.length ? { type: 'text', start: badLinkLocations[0].start, end: badLinkLocations[0].end } : { type: 'none' },
    locations: badLinkLocations.length ? badLinkLocations : null,
    fixable: false
  }));

  // Quote style (odd count = likely an unclosed quote somewhere). This is a
  // parity check, not fixable by definition — there's no way to know where
  // the missing quote should close, or whether the opening one was the
  // mistake. Well-paired straight quotes elsewhere in the document still get
  // normalized to typographic style via their own fix candidates, completely
  // independent of whether the document's overall count happens to be odd.
  const quoteMatches = [...md.matchAll(/"/g)];
  const quoteOdd = quoteMatches.length % 2 !== 0;
  R.push(mk({
    id: 'formatting-quote-style', category: 'formatting', title: 'Quote style',
    severity: !quoteOdd ? 'pass' : 'warning',
    detail: !quoteOdd ? `${quoteMatches.length} straight quote(s), evenly paired.` : `Odd number of straight quotes (${quoteMatches.length}) — one is likely unclosed. Not something Auto-Fix can guess at safely; find it starting from here.`,
    location: quoteOdd && quoteMatches.length ? { type: 'text', start: quoteMatches[0].index, end: quoteMatches[0].index + 1 } : { type: 'none' },
    fixable: false
  }));

  // Multiple punctuation
  const multiPunctLocations = util.locationsFromMatches([...md.matchAll(/([!?])\1{1,}/g)]);
  R.push(mk({
    id: 'formatting-multi-punct', category: 'formatting', title: 'Multiple punctuation',
    severity: multiPunctLocations.length === 0 ? 'pass' : 'suggestion',
    detail: multiPunctLocations.length === 0 ? 'None found.' : `${multiPunctLocations.length} instance(s) like "!!" or "??".`,
    location: multiPunctLocations.length ? { type: 'text', start: multiPunctLocations[0].start, end: multiPunctLocations[0].end } : { type: 'none' },
    locations: multiPunctLocations.length ? multiPunctLocations : null,
    fixable: multiPunctLocations.length > 0
  }));

  // Trailing spaces
  const trailingLocations = util.locationsFromMatches([...md.matchAll(/[ \t]+$/gm)]);
  R.push(mk({
    id: 'formatting-trailing-spaces', category: 'formatting', title: 'Trailing spaces',
    severity: trailingLocations.length === 0 ? 'pass' : 'suggestion',
    detail: trailingLocations.length === 0 ? 'None found.' : `${trailingLocations.length} line(s) with trailing whitespace.`,
    location: trailingLocations.length ? { type: 'text', start: trailingLocations[0].start, end: trailingLocations[0].end } : { type: 'none' },
    locations: trailingLocations.length ? trailingLocations : null,
    fixable: trailingLocations.length > 0
  }));

  return R;
};

/* Granular Auto-Fix: every fixable instance becomes its own candidate
   { id, category, start, end, before, after } instead of one all-or-nothing
   pass. The Editor tab previews these and lets the user apply all, some, or
   none — matching "Before / After, apply individually" from the original
   product vision instead of mutating the text the moment the button is clicked. */
HS.rules.getFormattingFixCandidates = function (md) {
  const raw = [];

  function addAll(category, matches, computeAfter) {
    matches.forEach(function (m) {
      raw.push({ category: category, start: m.index, end: m.index + m[0].length, before: m[0], after: computeAfter(m) });
    });
  }

  // Order matters for ties at the same position (see resolveOverlappingCandidates):
  // trailing-space run "claims" its span before double-spaces gets a chance at
  // the same characters; a quote pair claims its span — apostrophe included —
  // before the standalone apostrophe pass gets to it.
  addAll('Trailing spaces', [...md.matchAll(/[ \t]+$/gm)], function () { return ''; });
  addAll('Double spaces', [...md.matchAll(/ {2,}/g)], function () { return ' '; });
  addAll('Multiple blank lines', [...md.matchAll(/\n{3,}/g)], function () { return '\n\n'; });
  addAll('Multiple punctuation', [...md.matchAll(/([!?])\1{1,}/g)], function (m) { return m[1]; });
  addAll('Broken list marker', [...md.matchAll(/^([-*+])(\S)/gm)], function (m) { return m[1] + ' ' + m[2]; });
  addAll('Quote style', [...md.matchAll(/"([^"\n]*)"/g)], function (m) {
    return '\u201C' + m[1].replace(/(\w)'(\w)/g, '$1\u2019$2') + '\u201D';
  });
  addAll('Apostrophe', [...md.matchAll(/(\w)'(\w)/g)], function (m) { return m[1] + '\u2019' + m[2]; });

  return HS.util.resolveOverlappingCandidates(raw);
};

/* Applies only the given candidates (already filtered to the ones the user
   selected) to `md`. Processes from the end of the document backward so an
   earlier edit never invalidates the character positions of a later one. */
HS.rules.applyFixCandidates = function (md, candidates) {
  const sorted = candidates.slice().sort(function (a, b) { return b.start - a.start; });
  let result = md;
  sorted.forEach(function (c) {
    result = result.slice(0, c.start) + c.after + result.slice(c.end);
  });
  return result;
};
