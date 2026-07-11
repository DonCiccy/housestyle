/* Housestyle — Rich paste (Google Docs / Word / Notion) and DOCX import.
   Ported unchanged from Publishing Engine v1.1 — same tested cleanup pipeline. */

HS.paste = {};

HS.paste.detectSource = function (html) {
  if (/docs-internal-guid/i.test(html)) return 'gdocs';
  if (/mso-|class="Mso|urn:schemas-microsoft-com/i.test(html)) return 'word';
  return 'generic';
};

HS.paste.cleanHtml = function (html) {
  let cleaned = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<o:p>\s*<\/o:p>/gi, '')
    .replace(/<\/?o:p>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/^\s*<b[^>]*id="docs-internal-guid-[^"]*"[^>]*>/i, '')
    .replace(/<\/b>\s*$/i, '');

  cleaned = cleaned.replace(/href="https:\/\/www\.google\.com\/url\?q=([^&"]+)[^"]*"/gi, function (m, url) {
    try { return 'href="' + decodeURIComponent(url) + '"'; } catch (e) { return m; }
  });

  cleaned = cleaned.replace(/<span[^>]*font-size:\s*(\d+)pt[^>]*font-weight:\s*7\d\d[^>]*>([\s\S]*?)<\/span>/gi, function (m, size, inner) {
    const pt = parseInt(size, 10);
    let level = 0;
    if (pt >= 18) level = 1; else if (pt >= 15) level = 2; else if (pt >= 13) level = 3;
    return level ? ('<h' + level + '>' + inner + '</h' + level + '>') : m;
  });

  return cleaned;
};

HS.paste.insertAtCursor = function (textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  const newPos = start + text.length;
  textarea.selectionStart = textarea.selectionEnd = newPos;
};

HS.paste.sourceLabel = function (source) {
  const labels = {
    gdocs: 'Pasted from Google Docs — converted to Markdown',
    word: 'Pasted from Word — converted to Markdown',
    generic: 'Rich paste converted to Markdown'
  };
  return labels[source] || labels.generic;
};
