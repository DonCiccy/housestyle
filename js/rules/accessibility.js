/* Housestyle — Accessibility rules.
   Some of these overlap in substance with Structure/Readability checks
   (heading order, paragraph length) — kept as separate rules on purpose,
   since "is this well organized" and "can assistive tech navigate this"
   are different questions even when they're triggered by the same text.
   Paragraph length reuses the same maxParagraphWords setting as Readability,
   rather than a second, separately-configurable number for the same idea. */

HS.rules.accessibility = function (md) {
  const R = [];
  const mk = HS.util.makeResult;
  const util = HS.util;
  const cfg = HS.settings.current;

  // Missing ALT text — every occurrence navigable
  const images = [...md.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
  const missingAltLocations = images.filter(m => !m[1] || !m[1].trim()).map(m => ({ start: m.index, end: m.index + m[0].length }));
  R.push(mk({
    id: 'a11y-missing-alt', category: 'accessibility', title: 'Missing ALT text',
    severity: images.length === 0 ? 'pass' : missingAltLocations.length === 0 ? 'pass' : 'critical',
    detail: images.length === 0 ? 'No images in the document.' : missingAltLocations.length === 0 ? 'Every image has ALT text.' : `${missingAltLocations.length} image(s) missing ALT text.`,
    location: missingAltLocations.length ? { type: 'text', start: missingAltLocations[0].start, end: missingAltLocations[0].end } : { type: 'none' },
    locations: missingAltLocations.length ? missingAltLocations : null,
    fixable: false
  }));

  // Empty links — every occurrence navigable
  const emptyLinkLocations = util.locationsFromMatches([...md.matchAll(/\[\s*\]\([^)]*\)/g)]);
  R.push(mk({
    id: 'a11y-empty-links', category: 'accessibility', title: 'Empty links',
    severity: emptyLinkLocations.length === 0 ? 'pass' : 'critical',
    detail: emptyLinkLocations.length === 0 ? 'No empty link text found.' : `${emptyLinkLocations.length} link(s) with no visible text.`,
    location: emptyLinkLocations.length ? { type: 'text', start: emptyLinkLocations[0].start, end: emptyLinkLocations[0].end } : { type: 'none' },
    locations: emptyLinkLocations.length ? emptyLinkLocations : null,
    fixable: false
  }));

  // Heading order — every break point navigable
  const headingMatches = [...md.matchAll(/^(#{1,6})\s/gm)];
  const orderBreakLocations = [];
  let prev = 0;
  headingMatches.forEach(h => {
    const l = h[1].length;
    if (prev > 0 && l > prev + 1) orderBreakLocations.push({ start: h.index, end: h.index + h[0].length });
    prev = l;
  });
  R.push(mk({
    id: 'a11y-heading-order', category: 'accessibility', title: 'Heading order',
    severity: orderBreakLocations.length ? 'critical' : 'pass',
    detail: orderBreakLocations.length ? 'Headings skip a level — this breaks screen-reader navigation.' : 'Headings step down in order.',
    location: orderBreakLocations.length ? { type: 'text', start: orderBreakLocations[0].start, end: orderBreakLocations[0].end } : { type: 'none' },
    locations: orderBreakLocations.length ? orderBreakLocations : null,
    fixable: false
  }));

  // Paragraph length — every over-length paragraph navigable, same threshold as Readability
  const paragraphs = util.getMarkdownParagraphBlocks(md);
  const longParaLocations = [];
  let searchFrom = 0;
  paragraphs.forEach(function (p) {
    const wc = util.getWords(util.stripMarkdown(p)).length;
    const idx = md.indexOf(p, searchFrom);
    if (wc > cfg.maxParagraphWords && idx >= 0) longParaLocations.push({ start: idx, end: idx + p.length });
    if (idx >= 0) searchFrom = idx + p.length;
  });
  R.push(mk({
    id: 'a11y-paragraph-length', category: 'accessibility', title: 'Paragraph length',
    severity: longParaLocations.length === 0 ? 'pass' : 'suggestion',
    detail: longParaLocations.length === 0 ? 'No excessively long paragraphs.' : `${longParaLocations.length} paragraph(s) over ${cfg.maxParagraphWords} words — harder to scan for everyone, including screen-reader users.`,
    location: longParaLocations.length ? { type: 'text', start: longParaLocations[0].start, end: longParaLocations[0].end } : { type: 'none' },
    locations: longParaLocations.length ? longParaLocations : null,
    fixable: false
  }));

  return R;
};
