/* Housestyle — SEO rules.
   Most of these are properties of the SEO fields themselves (title, meta,
   slug, keyword) rather than a spot in the article body, so their location
   points at the *field*, not the text. Title/meta/keyword thresholds come
   from HS.settings.current; the "acceptable" (warning-tier) band is the ideal
   band padded by a fixed amount (HS.settings.TITLE_PAD / META_PAD), not a
   separate setting — keeps Settings from doubling in size for the same effect. */

HS.rules.seo = function (md, seo) {
  const R = [];
  const mk = HS.util.makeResult;
  const cfg = HS.settings.current;

  const plain = HS.util.stripMarkdown(md).toLowerCase();
  const words = HS.util.getWords(HS.util.stripMarkdown(md));

  // SEO title length
  const titleLen = (seo.title || '').length;
  const titleOkMin = cfg.titleIdealMin - HS.settings.TITLE_PAD, titleOkMax = cfg.titleIdealMax + HS.settings.TITLE_PAD;
  R.push(mk({
    id: 'seo-title-length', category: 'seo', title: 'SEO title length',
    severity: !seo.title ? 'critical' : (titleLen >= cfg.titleIdealMin && titleLen <= cfg.titleIdealMax) ? 'pass' : (titleLen >= titleOkMin && titleLen <= titleOkMax) ? 'warning' : 'critical',
    detail: !seo.title ? 'No SEO title set.' : `${titleLen} characters — ideal range is ${cfg.titleIdealMin}–${cfg.titleIdealMax}.`,
    location: { type: 'field', id: 'seoTitle' }, fixable: false
  }));

  // Meta description length
  const metaLen = (seo.meta || '').length;
  const metaOkMin = cfg.metaIdealMin - HS.settings.META_PAD, metaOkMax = cfg.metaIdealMax + HS.settings.META_PAD;
  R.push(mk({
    id: 'seo-meta-length', category: 'seo', title: 'Meta description length',
    severity: !seo.meta ? 'critical' : (metaLen >= cfg.metaIdealMin && metaLen <= cfg.metaIdealMax) ? 'pass' : (metaLen >= metaOkMin && metaLen <= metaOkMax) ? 'warning' : 'critical',
    detail: !seo.meta ? 'No meta description set.' : `${metaLen} characters — ideal range is ${cfg.metaIdealMin}–${cfg.metaIdealMax}.`,
    location: { type: 'field', id: 'seoMeta' }, fixable: false
  }));

  // Slug format
  const slugLen = (seo.slug || '').length;
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(seo.slug || '');
  R.push(mk({
    id: 'seo-slug-format', category: 'seo', title: 'Slug format',
    severity: !seo.slug ? 'critical' : (slugValid && slugLen <= 60) ? 'pass' : 'warning',
    detail: !seo.slug ? 'No slug set.' : slugValid ? `"${seo.slug}" — ${slugLen} characters, well formatted.` : 'Slug should be lowercase, hyphenated, no special characters.',
    location: { type: 'field', id: 'seoSlug' }, fixable: false
  }));

  // Keyword density
  let keywordDetail, keywordSeverity;
  if (!seo.keyword) {
    keywordSeverity = 'suggestion'; keywordDetail = 'No focus keyword set — add one to check density and placement.';
  } else {
    const kw = seo.keyword.toLowerCase();
    const occurrences = plain.split(kw).length - 1;
    const density = words.length ? (occurrences / words.length) * 100 : 0;
    keywordSeverity = (density >= cfg.keywordDensityMin && density <= cfg.keywordDensityMax) ? 'pass' : (density > 0) ? 'warning' : 'critical';
    keywordDetail = `"${seo.keyword}" appears ${occurrences} time(s), density ${density.toFixed(2)}% — aim for ${cfg.keywordDensityMin}–${cfg.keywordDensityMax}%.`;
  }
  R.push(mk({
    id: 'seo-keyword-density', category: 'seo', title: 'Keyword density',
    severity: keywordSeverity, detail: keywordDetail,
    location: { type: 'field', id: 'seoKeyword' }, fixable: false
  }));

  // Keyword in a heading — real text position if found, otherwise the field
  let keywordHeadingMatch = null;
  if (seo.keyword) {
    const re = new RegExp('^#{1,3}\\s.*(' + seo.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'im');
    keywordHeadingMatch = md.match(re);
  }
  R.push(mk({
    id: 'seo-keyword-in-heading', category: 'seo', title: 'Keyword in a heading',
    severity: !seo.keyword ? 'suggestion' : keywordHeadingMatch ? 'pass' : 'warning',
    detail: !seo.keyword ? 'Set a focus keyword to check this.' : keywordHeadingMatch ? 'Focus keyword found in at least one heading.' : 'Focus keyword not found in any heading.',
    location: keywordHeadingMatch ? { type: 'text', start: keywordHeadingMatch.index, end: keywordHeadingMatch.index + keywordHeadingMatch[0].length } : { type: 'field', id: 'seoKeyword' },
    fixable: false
  }));

  // Image ALT coverage — every image missing ALT is navigable
  const images = [...md.matchAll(/!\[(.*?)\]\((.*?)\)/g)];
  const missingAltLocations = images.filter(m => !m[1] || !m[1].trim()).map(m => ({ start: m.index, end: m.index + m[0].length }));
  R.push(mk({
    id: 'seo-image-alt', category: 'seo', title: 'Image ALT coverage',
    severity: images.length === 0 ? 'suggestion' : missingAltLocations.length === 0 ? 'pass' : 'critical',
    detail: images.length === 0 ? 'No images found.' : `${images.length - missingAltLocations.length}/${images.length} image(s) have ALT text.`,
    location: missingAltLocations.length ? { type: 'text', start: missingAltLocations[0].start, end: missingAltLocations[0].end } : { type: 'none' },
    locations: missingAltLocations.length ? missingAltLocations : null,
    fixable: false
  }));

  // Outbound / internal links — aggregate
  const linkCount = (md.match(/\[[^\]]*\]\([^)]+\)/g) || []).length - images.length;
  R.push(mk({
    id: 'seo-link-presence', category: 'seo', title: 'Outbound / internal links',
    severity: linkCount > 0 ? 'pass' : 'suggestion',
    detail: linkCount > 0 ? `${linkCount} link(s) found in the article.` : 'No links found — consider adding at least one relevant link.',
    location: { type: 'none' }, fixable: false
  }));

  return R;
};
