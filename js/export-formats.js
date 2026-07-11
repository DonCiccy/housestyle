/* Housestyle — Export formats, FAQ builder, structured data (JSON-LD).
   Ported unchanged from Publishing Engine v1.1. FAQ/JSON-LD stay deliberately
   conservative: no Yoast/RankMath-specific block markup (unverifiable against
   the live plugin, risks showing as an invalid block), only outputs that are
   guaranteed to work — core WordPress blocks, a plain Q&A list, or raw JSON-LD. */

HS.exportFmt = {};

HS.exportFmt.toGutenberg = function (md) {
  const tokens = marked.lexer(md);
  let out = '';
  const esc = HS.util.escapeHtml;

  tokens.forEach(function (token) {
    if (token.type === 'heading') {
      const level = token.depth;
      const html = marked.parseInline(token.text);
      out += `<!-- wp:heading {"level":${level}} -->\n<h${level} class="wp-block-heading">${html}</h${level}>\n<!-- /wp:heading -->\n\n`;
    } else if (token.type === 'paragraph') {
      const isSoloImage = /^!\[.*?\]\(.*?\)$/.test(token.text.trim());
      if (isSoloImage) {
        const m = token.text.trim().match(/^!\[(.*?)\]\((.*?)\)$/);
        const alt = esc(m ? m[1] : '');
        const src = m ? m[2] : '';
        out += `<!-- wp:image -->\n<figure class="wp-block-image"><img src="${src}" alt="${alt}"/></figure>\n<!-- /wp:image -->\n\n`;
      } else {
        out += `<!-- wp:paragraph -->\n<p>${marked.parseInline(token.text)}</p>\n<!-- /wp:paragraph -->\n\n`;
      }
    } else if (token.type === 'list') {
      const tag = token.ordered ? 'ol' : 'ul';
      const attr = token.ordered ? ' {"ordered":true}' : '';
      const items = token.items.map(it => `<li>${marked.parseInline(it.text)}</li>`).join('');
      out += `<!-- wp:list${attr} -->\n<${tag}>${items}</${tag}>\n<!-- /wp:list -->\n\n`;
    } else if (token.type === 'blockquote') {
      out += `<!-- wp:quote -->\n<blockquote class="wp-block-quote"><p>${marked.parseInline(token.text || '')}</p></blockquote>\n<!-- /wp:quote -->\n\n`;
    } else if (token.type === 'code') {
      out += `<!-- wp:code -->\n<pre class="wp-block-code"><code>${esc(token.text)}</code></pre>\n<!-- /wp:code -->\n\n`;
    } else if (token.type === 'hr') {
      out += `<!-- wp:separator -->\n<hr class="wp-block-separator"/>\n<!-- /wp:separator -->\n\n`;
    }
  });

  return out.trim();
};

HS.exportFmt.toPlainText = function (md) { return HS.util.stripMarkdown(md); };

HS.exportFmt.faqToGenericBlocks = function (items) {
  const valid = items.filter(i => i.q.trim());
  if (!valid.length) return '';
  const esc = HS.util.escapeHtml;
  return valid.map(function (i) {
    return '<!-- wp:heading {"level":3} -->\n<h3 class="wp-block-heading">' + esc(i.q) + '</h3>\n<!-- /wp:heading -->\n\n' +
      '<!-- wp:paragraph -->\n<p>' + esc(i.a) + '</p>\n<!-- /wp:paragraph -->';
  }).join('\n\n');
};

HS.exportFmt.faqToPlainList = function (items) {
  const valid = items.filter(i => i.q.trim());
  return valid.map(i => 'Q: ' + i.q + '\nA: ' + i.a).join('\n\n');
};

HS.exportFmt.faqToJsonLd = function (items) {
  const valid = items.filter(i => i.q.trim());
  if (!valid.length) return '';
  const data = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: valid.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } }))
  };
  return HS.util.SCRIPT_OPEN + JSON.stringify(data, null, 2) + HS.util.SCRIPT_CLOSE;
};

HS.exportFmt.extractFirstOrderedList = function (md) {
  const tokens = marked.lexer(md);
  const listToken = tokens.find(t => t.type === 'list' && t.ordered);
  if (!listToken) return null;
  return listToken.items.map(it => HS.util.stripMarkdown(it.text));
};

HS.exportFmt.articleJsonLd = function (md, seo, extra) {
  const meta = HS.engine.generateMetaSuggestions(md, { title: seo.title, meta: seo.meta, slug: '', keyword: '' });
  const data = { '@context': 'https://schema.org', '@type': 'Article', headline: seo.title || meta.title, description: seo.meta || meta.description };
  if (extra.author) data.author = { '@type': 'Person', name: extra.author };
  if (extra.date) data.datePublished = extra.date;
  return HS.util.SCRIPT_OPEN + JSON.stringify(data, null, 2) + HS.util.SCRIPT_CLOSE;
};

HS.exportFmt.breadcrumbJsonLd = function (pathStr) {
  const parts = pathStr.split('>').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const data = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: parts.map((name, i) => ({ '@type': 'ListItem', position: i + 1, name })) };
  return HS.util.SCRIPT_OPEN + JSON.stringify(data, null, 2) + HS.util.SCRIPT_CLOSE;
};

HS.exportFmt.howToJsonLd = function (md, title) {
  const steps = HS.exportFmt.extractFirstOrderedList(md);
  if (!steps || !steps.length) return null;
  const data = { '@context': 'https://schema.org', '@type': 'HowTo', name: title || 'Untitled how-to', step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) };
  return HS.util.SCRIPT_OPEN + JSON.stringify(data, null, 2) + HS.util.SCRIPT_CLOSE;
};
