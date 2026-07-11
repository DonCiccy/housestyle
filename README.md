# Housestyle

A content quality linter. Define what "good" means for your writing, and every draft gets checked against it — structure, readability, formatting, SEO, accessibility — before it goes anywhere near publishing.

**[→ Live demo](https://donciccy.github.io/housestyle)**

---

## What it does

A content linter for the web. It doesn't write anything, and it doesn't need AI to work. It analyzes a draft, runs a fixed set of checks against it, and gives back a prioritized list of problems — Critical, Warning, Suggestion — instead of a wall of text or a single opaque score. Click a problem and it jumps straight to where it is, in the article or in the relevant field. Fix what's mechanically fixable in one click. Export what's left as clean Markdown, HTML, or WordPress Gutenberg blocks.

It's built for anyone who writes for the web and wants a second pair of eyes before hitting publish — a marketer, a newsletter writer, a magazine editor, a documentation team. SEO is one of five check categories, not the point of the tool: turn the whole thing off in one click in Settings if you write for readers who already know where to find you, not for search traffic.

## Features

| Feature | Note |
|---|---|
| Problems Panel | The center of the experience, not the score. Every check groups into Critical / Warning / Suggestion; click any item to jump to it. Checks with several occurrences (e.g. 5 double spaces) show a "Next occurrence →" control instead of only ever jumping to the first one |
| Publishing Score | Lighthouse-style, 0–100 with a plain-English label (Excellent / Good / Needs work / Poor), broken down by category — the formula is fixed and visible in the source |
| Click-to-navigate | A dedicated "↗ Jump to it" button (not the whole card) selects the exact text in the editor; checks tied to a field (SEO title, meta, slug) get a button that focuses that field instead; document-level averages (like average sentence length) don't pretend to have a single position. Every navigable row shows a readable text snippet inline, not just a raw character offset. Real `<button>`s throughout, so keyboard access (Tab + Enter/Space) comes for free instead of being hand-rolled |
| Editorial standard (Settings tab) | The thresholds behind every check — sentence length, paragraph length, passive voice, reading grade level, SEO title/meta ranges, keyword density, minimum headings for a TOC — are adjustable, not hardcoded. Four starting presets (General / Balanced, News / Brief, In-depth / Feature, Explainer / Popular Science), each with a plain-English description; a "Suggest from my draft" button recommends the closest one from your article's actual average sentence and paragraph length, not from self-reported intentions. A master on/off switch per category (turn off all of SEO in one click if you don't publish to be found) plus a per-check toggle for finer control; a custom "words to avoid" list (its own check, only exists once you use it) with an optional one-click replacement; extra filler words on top of the built-in list. Editorial policy — minimum/maximum article length, required heading sections (e.g. every piece needs a heading mentioning "Sources"), the score threshold for "ready to publish" — is a separate axis from writing-style thresholds and survives switching presets, same as the check toggles and word lists. Everything saved to this browser only |
| Publish readiness | Zero Critical issues is non-negotiable; above that, your own score threshold decides "ready" from "not yet." Shown as a clear ✅ / 🟡 / 🔴 line at the top of the Problems tab with the specific reason, and as a small colored dot on the tab itself — deliberately not a number next to the word "Problems," which reads as a count rather than a score |
| Import / export profile | Everything in Settings — thresholds, enabled checks, word lists, editorial policy — as one named, dated JSON file. Share a standard across a whole editorial team, or move it to another device; settings otherwise live in this browser only |
| Rule Engine | Every check is a self-contained rule with a stable id, category, severity and (where it makes sense) an autofix — see `js/rules/` |
| Formatting toolbar | Bold, Italic, H1–H3, bulleted/numbered list, quote, link, image, horizontal rule — click to format, or click with nothing selected to insert a starter you type over. Ctrl/Cmd+B and Ctrl/Cmd+I work too. For anyone who, reasonably, doesn't have Markdown syntax memorized |
| Draft autosave | Your article, SEO fields and FAQ items save to this browser automatically as you work. Closing the tab or a crash won't lose your draft — reopening offers to restore it |
| Live preview | Rendered as you type, side-by-side with the Markdown source |
| Narrow-width check | Toggles the preview to ~375px to catch structural overflow (cramped tables, unbroken long strings) — not a simulation of your actual theme, which the tool has no way to see |
| Rich paste | Paste straight from Google Docs, Word or Notion — source auto-detected, converted to clean Markdown |
| DOCX import | Reads a `.docx` file client-side and converts it through the same pipeline as rich paste |
| Auto-Fix | Click it and nothing changes yet — you get a Before/After preview of every individual instance across Formatting, Readability and Structure (double spaces, trailing-space lines, straight quotes, repeated words, empty headings, extra H1s, and any "words to avoid" you gave a replacement for), grouped by category, each with its own checkbox and a live Overall-score preview that updates as you toggle. Apply all, apply some, or cancel. Problems Panel rows that have a matching fix show a green "🔧 Auto-fixable" badge — click it to jump straight into the review. Nothing that needs judgment is ever silently rewritten — only mechanical, unambiguous fixes are offered at all |
| SEO suggestions | Title, meta description, slug and excerpt suggestions appear right under each field with a "Use this" button — not off in a separate tab, disconnected from the fields they're meant to fill |
| TOC generator | Table of contents built from your headings |
| FAQ builder | Add Q&A pairs, export as generic WordPress blocks, a plain list for pasting into any FAQ plugin, or JSON-LD |
| Structured data | Article, Breadcrumb and HowTo JSON-LD generators, with a visible warning about duplicate schema if you already run an SEO plugin |
| Export | Markdown, HTML, Gutenberg blocks, plain text, clipboard copy, .md/.html download |
| Link preview & favicon | A proper card when the link is shared — title, description, and a 1200×630 branded image, covering both Open Graph (Slack, LinkedIn, iMessage) and Twitter Card. A small checkmark-mark favicon (`assets/favicon.svg`, PNG fallback for older browsers) so the tab is identifiable among a dozen others |

## How to use

1. Paste a draft — Markdown, plain text, or rich text from Google Docs / Word / Notion — import a `.docx`, or click "Load sample". Use the formatting toolbar above the editor if you'd rather click than type Markdown syntax
2. Fill in the SEO fields — suggestions based on your content appear under each one with a "Use this" button
3. Open the Problems tab: score at the top, then every issue grouped by severity — click one to jump to it, or step through multiple occurrences with "Next"
4. Click Auto-Fix to review every fixable instance individually, then apply what you want
5. Open the Export tab: copy a format, build an FAQ block, or generate structured data
6. In Settings, adjust the thresholds behind the checks if the defaults don't match how you write

## Technical approach

Everything runs client-side, no backend, no build step. `index.html` loads a set of plain JavaScript files — `js/utils.js`, `js/settings.js`, `js/rules/*.js`, `js/rule-engine.js`, `js/paste-import.js`, `js/export-formats.js`, `js/app.js` — as classic `<script src="...">` tags, in dependency order, all sharing one global namespace (`window.HS`). Deliberately not ES modules: `type="module"` imports are blocked by CORS when an HTML file is opened directly from disk, which would break "double-click to test locally." Classic scripts don't have that restriction, so the project stays genuinely zero-install while still being organized as one file per concern instead of one file with everything in it.

**The Rule Engine.** Every check — in `js/rules/structure.js`, `readability.js`, `formatting.js`, `seo.js`, `accessibility.js` — returns results shaped as `{ id, category, severity, title, detail, location, locations, fixable }`. `severity` is `pass | suggestion | warning | critical`, each worth a fixed number of points (100 / 75 / 50 / 0) that the category and overall scores are averaged from. `location` is the primary spot to jump to — `{ type: 'text', start, end }` for an exact span in the Markdown (computed against the raw source, not a stripped-down plain-text copy, so the offsets line up with what's actually in the textarea), `{ type: 'field', id }` for an SEO input rather than the article body, or `{ type: 'none' }` for document-level averages that genuinely don't have one spot to point to. `locations` (plural) is the full list of occurrences for checks where more than one instance exists — the Problems Panel uses it to offer "Next occurrence" instead of only ever jumping to the first hit.

**Configurable thresholds (`js/settings.js`).** Numeric thresholds — sentence length, paragraph length, passive voice ratio, reading grade level, SEO title/meta ideal ranges, keyword density, minimum headings for a TOC — live in `HS.settings.current`, not as hardcoded constants inside each rule. Rule functions read `HS.settings.current.xxx` at call time, so changing a value in the Settings tab and revisiting the Problems tab picks it up immediately. Four presets ship by default (General / Balanced, News / Brief, In-depth / Feature, Explainer / Popular Science); settings persist to `localStorage` only, nothing leaves the browser unless exported. Title/meta "acceptable" (warning-tier) bands are derived from the ideal band by a fixed padding rather than exposed as their own setting, to keep the Settings tab to about a dozen numbers instead of double that for the same practical control.

**Granular Auto-Fix, across three files.** Every fixable instance — a double space, a repeated word, an empty heading — becomes its own candidate: `{ id, category, start, end, before, after }`. `HS.rules.getFormattingFixCandidates`, `getReadabilityFixCandidates` and `getStructureFixCandidates` each propose candidates from their own domain; `HS.engine.getAllFixCandidates` concatenates the three and runs them through `HS.util.resolveOverlappingCandidates`, the shared resolver every one of them also uses internally. That resolver sorts by position and greedily keeps the first non-overlapping candidate — on a tie at the same start, the *longer* span wins, not just whichever was added first: an "Empty heading" fix that also swallows a surrounding blank-line run correctly beats a plain "Multiple blank lines" fix for those same characters, so removing the heading doesn't leave a stray blank line for a second pass to clean up. `HS.rules.applyFixCandidates` takes only the ones the user left checked and applies them from the end of the document backward, so accepting or rejecting one candidate never shifts the character positions the others were computed against. The live score preview reruns `computeScores` (Overall, not just Formatting, since fixes now span three categories) against a throwaway copy of the text on every checkbox change — nothing is written to the real draft until "Apply" is clicked.

**What's fixable, what isn't, and why — the short version:**

| | Examples | Why |
|---|---|---|
| **Auto-fixable now** | Double/trailing spaces, blank-line runs, repeated punctuation, broken list markers, well-paired quotes/apostrophes, repeated words, empty headings, extra H1s, skipped heading levels, avoid-list terms with a replacement | Mechanical — there's exactly one correct output, no judgment involved |
| **Flagged only** | Malformed/empty links, an odd (likely unclosed) quote, sentence/paragraph length, passive voice, filler words, missing ALT text, keyword density/placement | Fixing any of these means guessing intent (which URL? where does the quote close?) or rewriting content, which changes meaning — the kind of judgment call this project deliberately keeps out of the deterministic core |
| **Suggested, not auto-applied** | SEO title/meta/slug/excerpt | Lives in the Editor tab next to the fields it fills, with a "Use this" button — not in Auto-Fix, since these aren't "wrong," just empty |

Every check's `fixable` flag is meant to track this table exactly — a Problems Panel row only shows the green badge when `HS.engine.getAllFixCandidates` genuinely has a candidate for that specific instance, not just "Auto-Fix touches this category in general." Getting that distinction wrong once (the "Quote style" check briefly claimed `fixable: true` for the *odd-count* warning, which nothing can safely auto-resolve — only well-paired quotes elsewhere get fixed) is exactly the kind of mismatch a person would run into and rightly call confusing, so there's now a standing test that cross-checks every `fixable: true` result against a real matching candidate on a deliberately messy document, rather than trusting each check to self-report correctly.

**Avoid-list terms with a replacement.** The Settings textarea accepts a plain term (`synergy`) for flag-only detection, or `term -> replacement` (`Facebook Ads -> Meta Ads`) to also make it a one-click Auto-Fix candidate — same list, same field, no separate UI. `HS.util.normalizeAvoidPhrases` reads both the new `{term, replacement}` object format and plain strings from before this existed, so nobody's saved settings break.

**Skipped heading levels are fixable too, cascade-aware.** `HS.rules._findHeadingSkips` — shared by the check and by `getStructureFixCandidates`, so the two can never disagree about what counts as a skip — walks headings in order tracking the *effective* (already-corrected) previous level rather than the raw one. A chain like H1 → H4 → H5 resolves to H1 → H2 → H3 in one pass, not H1 → H2 → (still broken), because each heading's fix is computed against what its predecessor will actually become, not what it originally was.

**Reading grade level uses the standard Flesch-Kincaid formula** (`0.39 × words/sentence + 11.8 × syllables/word − 15.59`) against a heuristic syllable counter — the same rule-based approach every web-based readability tool uses in the absence of a full pronouncing dictionary, so treat it the same way as the passive-voice check: a guide, not a verdict. Only penalized for being *harder* than the target grade; writing simpler than intended is never flagged.

**Disabling a whole category needs no special-case scoring logic.** `HS.engine.overallScore` already skips any category whose score is `null` and renormalizes the remaining weights — that's what happens automatically once every check in a category is disabled (`categoryScore` returns `null` for an empty result set), so turning off all of SEO just works, no separate code path needed for "some categories don't apply to you."

**Publish readiness (`HS.engine.publishReadiness`)** is one function, called by both the tab-bar dot and the banner at the top of the Problems tab, so they can never show different answers. Critical issues always block regardless of score — that threshold isn't configurable, since it's hard to construct a scenario where a publication actually wants to ship something critically broken. The score bar above that (`readyThreshold` in Settings) is the team's own call.

**The exported profile is just `HS.settings.current`, plus a name and a timestamp.** Nothing device-specific has ever lived in that object — no UI theme, no layout preference — so there was no field-by-field decision to make about what ships in the file versus what stays local; the whole thing travels. `HS.settings.sanitizeImported` accepts either the full `{name, exportedAt, settings}` wrapper or a bare settings object, merges it over whatever's currently loaded (so a file from an older version missing a newer field doesn't leave that field `undefined`), and coerces every known numeric and array field to the right type — a hand-edited or corrupted file falls back to the current value field-by-field rather than failing the whole import or leaving a stray `NaN` threshold silently broken.

**"Apply all" takes a follow-up pass; a partial selection doesn't.** Some fixes reveal a new issue as a side effect — removing an empty heading can turn a previously-fine H1 → H3 step into a real skip, since the empty heading was quietly satisfying the "one level at a time" rule just by existing. When every candidate shown gets selected, applying is followed by one more scan of the result and, if anything new turned up, one more apply — so "Apply all" reliably means *all*, not "all of what I could see up front." Selecting only some candidates skips this: a partial choice is left exactly as chosen, no fixes the user didn't ask for.

**Click-to-navigate** uses the browser's native `textarea.setSelectionRange()` plus focus, not a rebuilt editor — real inline highlighting of several problems at once (Grammarly-style) would need replacing the textarea with a proper editor component, which is real added complexity, deliberately not taken on until it's clear the simpler navigation isn't enough. Clickable Problems Panel rows are real keyboard targets (`tabindex`, `role="button"`, Enter/Space), not mouse-only.

**Draft autosave** writes to `localStorage` on a debounce, the same mechanism as Settings — nothing is sent anywhere. On load, if a non-empty draft exists, a banner offers to restore it rather than silently overwriting whatever's already in the editor.

**Rich paste and DOCX import** both funnel into the same pipeline: clean the HTML (strip Word's `mso-` markup, unwrap Google Docs' link-redirect URLs, reconstruct headings from Google Docs' font-size-based styling), then convert to Markdown with [turndown.js](https://github.com/mixmark-io/turndown). DOCX goes through [mammoth.js](https://github.com/mwilliamson/mammoth.js) first, which is intentionally semantic rather than pixel-faithful — it relies on the source using Word's real heading styles, and doesn't extract page headers/footers, which don't map to flowing HTML content.

**FAQ and structured data stay conservative on purpose.** No attempt to reproduce Yoast's or RankMath's exact FAQ block markup — that's not verifiable against the live plugin, and a wrong attribute shows up in the block editor as an invalid block, worse than not having it. The FAQ builder offers three outputs guaranteed to work instead: generic WordPress core blocks, a plain Q&A list to paste into whatever plugin you use, and standalone JSON-LD.

## Roadmap

Phase 1 (Rule Engine + Problems Panel), Phase 2 (configurable thresholds) and exportable/shareable standard profiles are all done, including the follow-on fixes usage turned up: multi-occurrence navigation, keyboard accessibility, draft persistence, a formatting toolbar for anyone who — reasonably — doesn't have Markdown syntax memorized, granular Auto-Fix, reading grade level, and per-category check toggles.

**Next, if it earns it:** an Advanced/Expert tier with raw JSON editing for developers, and — only if the current click-to-select navigation turns out not to be enough — a real editor component for persistent multi-highlight.

**Deliberately dropped: an onboarding wizard.** The original plan was a few questions (content type, SEO importance, readability level) mapped to a dozen bespoke thresholds. With only three presets to land on, that mapping would have been invented numbers dressed up as personalization — more questions than the three-way output actually justifies. What shipped instead: short descriptions under each preset for an informed manual pick, plus "Suggest from my draft," which recommends a preset from the article's *actual* average sentence and paragraph length — real numbers, shown alongside the recommendation, not a guess about intentions.

**Deliberately out of scope: "Require CTA" / "Require FAQ" checks.** Both were in the original vision doc. Detecting either reliably needs judgment a keyword list can't give — too many ways to phrase a call-to-action, too many false positives/negatives either way — which means doing them well would mean bringing AI into the core engine, which is exactly what stays out by design. ("Require TOC" already exists — that one's just a heading count, no judgment involved.)

**Explicitly not planned:** an AI module is possible eventually (rewrite suggestions, generated FAQs) but stays fully separate from the core engine, which is deterministic by design and always has to work without it.

## Local development

Open `index.html` in any browser — no server, no build step, no installation. Because the JS is loaded as classic scripts rather than ES modules, this works even via `file://` (double-click the file), not just when served over HTTP.

## License

MIT — use it freely, credits appreciated.
