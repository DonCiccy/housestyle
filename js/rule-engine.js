/* Housestyle — Rule engine. Runs every rules/*.js module, aggregates results,
   computes the Publishing Score, and shapes data for the Problems Panel. */

HS.engine = {};

HS.engine.SEVERITY_POINTS = { pass: 100, suggestion: 75, warning: 50, critical: 0 };
HS.engine.CATEGORY_WEIGHTS = { structure: 0.20, readability: 0.20, formatting: 0.20, seo: 0.25, accessibility: 0.15 };

HS.engine.computeStats = function (md) {
  const util = HS.util;
  const plain = util.stripMarkdown(md);
  const words = util.getWords(plain);
  const sentences = util.getSentences(plain);
  const paragraphs = util.getMarkdownParagraphBlocks(md);
  const headings = (md.match(/^#{1,6}\s+.+$/gm) || []).length;
  const images = (md.match(/!\[.*?\]\(.*?\)/g) || []).length;
  const links = (md.match(/\[[^\]]*\]\([^)]*\)/g) || []).length - images;
  const wordCount = words.length;

  return {
    words: wordCount,
    characters: plain.length,
    paragraphs: paragraphs.length,
    sentences: sentences.length,
    headings,
    images,
    links: Math.max(links, 0),
    readingTime: Math.max(1, Math.round(wordCount / 200)),
    speakingTime: Math.max(1, Math.round(wordCount / 130)),
  };
};

HS.engine.runAllRules = function (md, seo) {
  const disabled = new Set(HS.settings.current.disabledChecks || []);
  function keep(results) { return results.filter(r => !disabled.has(r.id)); }
  return {
    structure: keep(HS.rules.structure(md)),
    readability: keep(HS.rules.readability(md)),
    formatting: keep(HS.rules.formatting(md)),
    seo: keep(HS.rules.seo(md, seo)),
    accessibility: keep(HS.rules.accessibility(md)),
  };
};

HS.engine.categoryScore = function (results) {
  if (!results.length) return null;
  const total = results.reduce((sum, r) => sum + HS.engine.SEVERITY_POINTS[r.severity], 0);
  return Math.round(total / results.length);
};

HS.engine.overallScore = function (categoryScores) {
  let weighted = 0, weightSum = 0;
  Object.keys(HS.engine.CATEGORY_WEIGHTS).forEach(function (key) {
    if (categoryScores[key] !== null && categoryScores[key] !== undefined) {
      weighted += categoryScores[key] * HS.engine.CATEGORY_WEIGHTS[key];
      weightSum += HS.engine.CATEGORY_WEIGHTS[key];
    }
  });
  return weightSum > 0 ? Math.round(weighted / weightSum) : 0;
};

/* Flattens per-category rule results into the three Problems Panel buckets.
   'pass' results are dropped here — they don't need to show up as a problem,
   they're already reflected in the score and in each category's pass count. */
HS.engine.groupBySeverity = function (allResults) {
  const flat = [].concat(allResults.structure, allResults.readability, allResults.formatting, allResults.seo, allResults.accessibility);
  return {
    critical: flat.filter(r => r.severity === 'critical'),
    warning: flat.filter(r => r.severity === 'warning'),
    suggestion: flat.filter(r => r.severity === 'suggestion'),
    passCount: flat.filter(r => r.severity === 'pass').length,
    total: flat.length
  };
};

HS.engine.generateTOC = function (md) {
  const headings = [...md.matchAll(/^(#{2,4})\s+(.*)$/gm)];
  if (!headings.length) return null;
  return headings.map(h => ({ level: h[1].length, text: h[2].trim(), anchor: HS.util.slugify(h[2]) }));
};

HS.engine.generateMetaSuggestions = function (md, seo) {
  const h1Match = md.match(/^#\s+(.*)$/m);
  const plainParas = HS.util.getMarkdownParagraphBlocks(md);
  const firstPara = plainParas.length ? HS.util.stripMarkdown(plainParas[0]) : '';

  const titleSuggestion = seo.title || (h1Match ? h1Match[1].trim() : 'Untitled article');
  let descSuggestion = seo.meta || firstPara;
  if (descSuggestion.length > 158) descSuggestion = descSuggestion.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const slugSuggestion = seo.slug || HS.util.slugify(h1Match ? h1Match[1] : titleSuggestion);
  let excerptSuggestion = firstPara;
  if (excerptSuggestion.length > 200) excerptSuggestion = excerptSuggestion.slice(0, 197).replace(/\s+\S*$/, '') + '…';

  return { title: titleSuggestion, description: descSuggestion, slug: slugSuggestion, excerpt: excerptSuggestion };
};

/* Same idea, but always derived from the article itself, ignoring whatever is
   already in the SEO fields — used for the "Use this" suggestion chips in the
   Editor tab, where the point is to offer an alternative, not echo back what's
   already there (generateMetaSuggestions does that, for the JSON-LD generators). */
HS.engine.deriveMetaFromContent = function (md) {
  const h1Match = md.match(/^#\s+(.*)$/m);
  const plainParas = HS.util.getMarkdownParagraphBlocks(md);
  const firstPara = plainParas.length ? HS.util.stripMarkdown(plainParas[0]) : '';

  const title = h1Match ? h1Match[1].trim() : '';
  let description = firstPara;
  if (description.length > 158) description = description.slice(0, 155).replace(/\s+\S*$/, '') + '…';
  const slug = title ? HS.util.slugify(title) : '';
  let excerpt = firstPara;
  if (excerpt.length > 200) excerpt = excerpt.slice(0, 197).replace(/\s+\S*$/, '') + '…';

  return { title, description, slug, excerpt };
};

/* Combines every getXFixCandidates() source into one list for the Auto-Fix
   review panel. Each source already resolves overlaps within itself; this
   runs the same resolution once more across the combined set, which is only
   ever relevant if two *different* categories happened to touch the same
   characters — not expected in practice given how different these patterns
   are, but cheap insurance rather than an assumption. */
HS.engine.getAllFixCandidates = function (md) {
  const combined = []
    .concat(HS.rules.getFormattingFixCandidates(md))
    .concat(HS.rules.getReadabilityFixCandidates(md))
    .concat(HS.rules.getStructureFixCandidates(md));
  return HS.util.resolveOverlappingCandidates(combined);
};

/* The single definition of "is this ready to publish", shared by the tab-bar
   dot and the status line in the Problems tab so they can never disagree.
   Zero Critical issues is non-negotiable — no configurable way around that,
   on the reasoning that it's hard to imagine an editorial team that wants to
   publish knowing something is critically broken. The score threshold below
   that is the team's own call, via readyThreshold in Settings. */
HS.engine.publishReadiness = function (overall, criticalCount, threshold) {
  if (criticalCount > 0) {
    return { status: 'red', ready: false, reason: `${criticalCount} critical issue${criticalCount === 1 ? '' : 's'} must be fixed first.` };
  }
  if (overall < threshold) {
    return { status: 'yellow', ready: false, reason: `Score ${overall} is below your ${threshold} publishing threshold.` };
  }
  return { status: 'green', ready: true, reason: `No critical issues, and score ${overall} meets your ${threshold} threshold.` };
};
