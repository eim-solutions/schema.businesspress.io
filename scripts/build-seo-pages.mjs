import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'public');
const origin = 'https://schema.businesspress.io';
const updated = '2026-08-11';

const pages = [
  {
    slug: 'schema-markup-checker',
    name: 'Schema Markup Checker',
    title: 'Schema Markup Checker — Test Schema.org Markup | SEOMarkup',
    description: 'Check Schema.org markup from a public URL. Find JSON-LD, Microdata and RDFa, review syntax issues, and see the exact source evidence.',
    intro: 'Enter a public page to find its Schema.org markup, types and structural issues. The report shows what is declared in the source without inventing a score.',
    summary: 'Use this check before publishing a page, after a template change, or when structured data is missing from search tools.',
    checks: ['JSON-LD blocks and declared types', 'Microdata item types and properties', 'RDFa vocabularies and properties', 'Invalid JSON, empty blocks and duplicate identifiers'],
    review: [
      ['Start with syntax', 'Invalid JSON-LD cannot be read reliably. Fix malformed JSON before reviewing the meaning of the data.'],
      ['Check the declared type', 'Confirm that each type describes the visible page content and that required business facts are not invented.'],
      ['Confirm the rendered page', 'This browser report checks source HTML. Use the local extension to find schema added after JavaScript runs.'],
    ],
    faq: [
      ['What schema formats does this checker find?', 'It finds JSON-LD, Microdata and RDFa in the public page source.'],
      ['Does a clean report guarantee a Google rich result?', 'No. SEOMarkup checks structure and direct evidence, not search feature eligibility or ranking impact.'],
      ['Can I check a private or local page?', 'Use the Chrome extension for pages that must stay on your device. The website only accepts public web URLs.'],
    ],
    related: ['structured-data-checker', 'json-ld-validator', 'meta-tag-checker'],
  },
  {
    slug: 'structured-data-checker',
    name: 'Structured Data Checker',
    title: 'Structured Data Checker — Inspect JSON-LD, RDFa & Microdata',
    description: 'Inspect structured data on a public page. Review JSON-LD, RDFa and Microdata types, syntax, identifiers and source evidence in one report.',
    intro: 'Check the structured data a page publishes in JSON-LD, RDFa and Microdata. Open every detected block and review the source behind each finding.',
    summary: 'This is a broad structured-data review for developers, marketers and editors who need to see what a page actually declares.',
    checks: ['All three common Schema.org formats', 'Types, nested entities and identifiers', 'Duplicate @id values and parsing problems', 'Page-level SEO and social metadata alongside schema'],
    review: [
      ['Compare formats', 'Pages can publish more than one structured-data format. Check whether repeated entities agree rather than conflict.'],
      ['Trace identifiers', 'Stable @id values can connect entities. Duplicate or inconsistent identifiers deserve a manual review.'],
      ['Match visible content', 'Structured data should describe content people can see on the page, not hidden or unrelated claims.'],
    ],
    faq: [
      ['What is structured data?', 'Structured data is machine-readable markup that describes entities and relationships on a page.'],
      ['Is structured data the same as Schema.org?', 'Schema.org provides the vocabulary commonly expressed through JSON-LD, Microdata or RDFa.'],
      ['Does the website run the target page JavaScript?', 'No. The web checker reads the fetched source HTML. The extension inspects the rendered tab locally.'],
    ],
    related: ['schema-markup-checker', 'json-ld-validator', 'tracking-pixel-checker'],
  },
  {
    slug: 'json-ld-validator',
    name: 'JSON-LD Validator',
    title: 'JSON-LD Validator — Check Schema JSON Syntax | SEOMarkup',
    description: 'Validate JSON-LD blocks from a public URL. Find invalid JSON, review Schema.org types, nested entities, @id values and formatted source.',
    intro: 'Find and validate every JSON-LD block in a public page source. Invalid JSON is flagged, while valid blocks stay open for a clear entity-by-entity review.',
    summary: 'Use the validator after editing templates, CMS fields or injected scripts that produce application/ld+json markup.',
    checks: ['application/ld+json script blocks', 'JSON parsing and empty block errors', '@context, @type and nested entities', 'Repeated @id values across blocks'],
    review: [
      ['Fix parsing errors first', 'A stray comma, unescaped quote or truncated value can invalidate an entire JSON-LD block.'],
      ['Review every entity', 'One script can contain an @graph or nested objects. Open the block and confirm each entity is expected.'],
      ['Test eligibility separately', 'Valid JSON does not prove that a search engine supports the type or will show a rich result.'],
    ],
    faq: [
      ['What does this JSON-LD validator check?', 'It parses each JSON-LD script, lists its entities and types, and flags structural issues found by SEOMarkup.'],
      ['Can it validate pasted JSON-LD?', 'This page checks JSON-LD published at a public URL. A pasted-code mode is not included yet.'],
      ['Why can valid JSON-LD still have warnings?', 'JSON syntax can be valid while identifiers, types or page context still need a manual review.'],
    ],
    related: ['schema-markup-checker', 'structured-data-checker', 'meta-tag-checker'],
  },
  {
    slug: 'social-media-preview-checker',
    name: 'Social Media Preview Checker',
    title: 'Social Media Preview Checker — Preview Share Titles & Images',
    description: 'Preview how a public page may look when shared on Facebook, X/Twitter and LinkedIn, plus a Google-style search preview.',
    intro: 'Check the titles, descriptions and images declared for social sharing. Compare platform previews before a campaign or page launch.',
    summary: 'SEOMarkup builds approximate previews from the page metadata and keeps remote images blocked until you choose to load them.',
    checks: ['Open Graph title, description and image', 'Twitter/X card type and content', 'LinkedIn-style Open Graph preview', 'Google-style title, URL and description preview'],
    review: [
      ['Lead with the right title', 'Make the shared title specific, readable and consistent with the destination page.'],
      ['Check image intent', 'Confirm the declared image represents the page and remains understandable when a platform crops it.'],
      ['Expect platform changes', 'Networks may cache, crop or rewrite metadata. Treat these previews as a practical approximation.'],
    ],
    faq: [
      ['Which platforms can I preview?', 'The report includes Google, Facebook, X/Twitter and LinkedIn-style previews.'],
      ['Does checking a page load its social image?', 'Not automatically. Preview images load only after you select the load-images control.'],
      ['Will the live post look exactly the same?', 'Not always. Platforms apply their own cache, crop and display rules.'],
    ],
    related: ['open-graph-checker', 'twitter-card-checker', 'meta-tag-checker'],
  },
  {
    slug: 'open-graph-checker',
    name: 'Open Graph Checker',
    title: 'Open Graph Checker — Test OG Title, Description & Image',
    description: 'Check Open Graph tags from a public URL. Review og:title, og:description, og:image and og:url with Facebook and LinkedIn previews.',
    intro: 'Inspect the Open Graph tags used by Facebook, LinkedIn and other sharing tools. See declared values and approximate card previews in one report.',
    summary: 'Use this check when a shared link shows the wrong headline, image, description or destination URL.',
    checks: ['og:title and og:description', 'og:image and image alt text', 'og:url and canonical alignment', 'Facebook and LinkedIn-style previews'],
    review: [
      ['Check the core trio', 'A useful share card normally needs a clear title, description and image that describe the destination.'],
      ['Compare URLs', 'Review og:url beside the canonical URL so shares do not point at an unintended variant.'],
      ['Refresh network caches', 'If tags are correct but an old preview remains, the social platform may still have cached metadata.'],
    ],
    faq: [
      ['What are Open Graph tags?', 'They are page metadata used by social platforms and messaging tools to build link previews.'],
      ['Does LinkedIn use Open Graph data?', 'LinkedIn commonly reads Open Graph fields when it builds a shared-link preview.'],
      ['Why is my old Open Graph image still showing?', 'A platform cache may still hold an earlier version even after the source metadata changes.'],
    ],
    related: ['social-media-preview-checker', 'twitter-card-checker', 'meta-tag-checker'],
  },
  {
    slug: 'twitter-card-checker',
    name: 'Twitter Card Checker',
    title: 'Twitter Card Checker — Preview X/Twitter Cards | SEOMarkup',
    description: 'Check Twitter Card metadata and preview X/Twitter link cards. Review card type, title, description and image from a public URL.',
    intro: 'Review the Twitter Card metadata behind an X/Twitter share. Compare the declared card type, copy and image before you publish the link.',
    summary: 'The preview follows declared metadata, while making clear that X may apply its own cache, crop and presentation rules.',
    checks: ['twitter:card type', 'twitter:title and twitter:description', 'twitter:image and image alt text', 'Fallbacks to Open Graph metadata'],
    review: [
      ['Choose the card type deliberately', 'A summary card and a large-image card create different emphasis. Confirm the declared type fits the content.'],
      ['Keep copy concise', 'Long titles and descriptions can be shortened by the platform, so put the important meaning first.'],
      ['Review fallback behavior', 'When Twitter-specific fields are absent, platforms may use Open Graph values instead.'],
    ],
    faq: [
      ['Is this the old Twitter Card Validator?', 'It is an independent metadata checker and approximate preview for X/Twitter cards.'],
      ['What if twitter:title is missing?', 'The report shows the declared metadata and may preview an Open Graph fallback when one is available.'],
      ['Does this publish or request a post?', 'No. It only checks the public page source you submit.'],
    ],
    related: ['social-media-preview-checker', 'open-graph-checker', 'meta-tag-checker'],
  },
  {
    slug: 'meta-tag-checker',
    name: 'Meta Tag Checker',
    title: 'SEO Meta Tag Checker — Test Titles, Canonicals & Social Tags',
    description: 'Check SEO meta tags from a public URL, including title, description, canonical, robots, language, viewport, headings and social metadata.',
    intro: 'Review the search and social metadata declared by a public page. Find missing or conflicting fields and open the evidence behind each result.',
    summary: 'Use this check during page QA, migrations and template updates to catch metadata problems before they spread across a site.',
    checks: ['Title and meta description', 'Canonical URL and robots directives', 'Language, viewport, headings and hreflang', 'Open Graph and Twitter/X fields'],
    review: [
      ['Check index signals together', 'A canonical and robots directive can each look reasonable alone but conflict when considered together.'],
      ['Review the page outline', 'A clear main heading helps people and machines understand the page subject.'],
      ['Compare search and social copy', 'Search snippets and social cards serve different contexts, but both should accurately describe the page.'],
    ],
    faq: [
      ['Which SEO meta tags does this checker review?', 'It reviews title, description, canonical, robots, language, viewport, headings, hreflang and social fields.'],
      ['Does a title length warning mean Google will truncate it?', 'No. Display varies by query and device; the warning is guidance for manual review.'],
      ['Can this checker see JavaScript-injected tags?', 'The website checks source HTML. Use the extension to inspect the rendered tab.'],
    ],
    related: ['schema-markup-checker', 'social-media-preview-checker', 'tracking-pixel-checker'],
  },
  {
    slug: 'tracking-pixel-checker',
    name: 'Tracking Pixel Checker',
    title: 'Tracking Pixel Checker — Find Analytics & Ad Tags',
    description: 'Find common tracking pixels, analytics, advertising, consent, replay and monitoring tags in a public page source, with direct evidence.',
    intro: 'Check a public page for common analytics, advertising and monitoring tags. Every detection includes the matching source evidence instead of a vague badge.',
    summary: 'Use this as a fast inventory during privacy reviews, migrations or tag-manager cleanup—not as a legal compliance verdict.',
    checks: ['Analytics and tag-manager signatures', 'Advertising and conversion pixels', 'Consent, replay and monitoring tools', 'Matching source and confidence for each detection'],
    review: [
      ['Treat detections as an inventory', 'A detected tag shows matching code in the source. It does not prove when the tag fires or what data it sends.'],
      ['Check the rendered tab', 'Tag managers and scripts can add trackers after load. Use the extension for rendered-page evidence.'],
      ['Review unfamiliar code manually', 'Custom, proxied, server-side or uncommon tracking tools may not match the built-in signatures.'],
    ],
    faq: [
      ['Which tracking tools can SEOMarkup detect?', 'It checks common analytics, advertising, consent, replay and monitoring signatures. Coverage is useful but not exhaustive.'],
      ['Does a detection prove a privacy violation?', 'No. The report is a technical inventory, not a legal or consent-compliance decision.'],
      ['Are tracking IDs exposed in exported reports?', 'SEOMarkup redacts common tracking query values in its interface and explicit exports.'],
    ],
    related: ['meta-tag-checker', 'structured-data-checker', 'social-media-preview-checker'],
  },
];

const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
const checkMode = process.argv.includes('--check');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function poweredByMarkup() {
  return '<a class="powered-by" href="https://businesspress.io/?utm_source=seomarkup&amp;utm_medium=footer" target="_blank" rel="noopener noreferrer"><span>Powered by</span><img src="/assets/businesspress-logo.png" alt="BusinessPress — Professional Business Solutions" width="125" height="20" loading="lazy" decoding="async"></a>';
}

function structuredData(page) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${origin}/${page.slug}/#page`,
        url: `${origin}/${page.slug}/`,
        name: page.name,
        description: page.description,
        isPartOf: { '@id': `${origin}/#website` },
        mainEntity: { '@id': `${origin}/#software` },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        url: `${origin}/`,
        name: 'SEOMarkup',
        publisher: { '@type': 'Organization', name: 'BusinessPress', url: 'https://businesspress.io/' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'SEOMarkup', item: `${origin}/` },
          { '@type': 'ListItem', position: 2, name: page.name, item: `${origin}/${page.slug}/` },
        ],
      },
      {
        '@type': 'SoftwareApplication',
        '@id': `${origin}/#software`,
        name: 'SEOMarkup Structured Data Schema Inspector',
        applicationCategory: 'BrowserApplication',
        operatingSystem: 'Web, Chrome',
        url: `${origin}/`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: { '@type': 'Organization', name: 'BusinessPress', url: 'https://businesspress.io/' },
      },
    ],
  }, null, 2).replaceAll('<', '\\u003c');
}

function sitemapStructuredData() {
  const entries = [
    { name: 'SEOMarkup', url: `${origin}/` },
    ...pages.map((page) => ({ name: page.name, url: `${origin}/${page.slug}/` })),
    { name: 'Privacy policy', url: `${origin}/privacy/` },
  ];

  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${origin}/sitemap/#page`,
    url: `${origin}/sitemap/`,
    name: 'SEOMarkup sitemap',
    description: 'Browse every public SEOMarkup checker and information page.',
    isPartOf: { '@id': `${origin}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: entry.name,
        url: entry.url,
      })),
    },
  }, null, 2).replaceAll('<', '\\u003c');
}

function reportMarkup() {
  return `
      <section class="browser-report" id="browserReport" aria-labelledby="reportTitle" hidden>
        <header class="browser-report-header">
          <div><h2 id="reportTitle">Page title</h2><a id="reportUrl" href="https://example.com" target="_blank" rel="noopener noreferrer">https://example.com</a><p id="reportMeta">Source HTML · not saved</p></div>
          <div class="report-actions"><button class="button button-secondary" id="shareWebReport" type="button" disabled>Copy share link</button><button class="button button-secondary" id="copyWebReport" type="button">Copy summary</button><button class="button button-primary" id="exportWebReport" type="button">Download JSON</button></div>
        </header>
        <div class="browser-stats" id="reportStats" aria-label="Page check summary"></div>
        <nav class="report-tabs" id="reportTabs" role="tablist" aria-label="Report sections">
          <button class="active" type="button" role="tab" aria-selected="true" data-report-tab="overview">Overview</button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-report-tab="schema">Schema <span>0</span></button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-report-tab="seo">Search</button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-report-tab="social">Social</button>
          <button type="button" role="tab" aria-selected="false" tabindex="-1" data-report-tab="tracking">Tracking <span>0</span></button>
        </nav>
        <div class="browser-report-panel" id="reportPanel" role="tabpanel" tabindex="0"></div>
      </section>`;
}

function renderPage(page) {
  const related = page.related.map((slug) => pageBySlug.get(slug));
  const url = `${origin}/${page.slug}/`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#1447e6">
  <link rel="canonical" href="${url}">
  <link rel="icon" href="/favicon.png" sizes="32x32">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="SEOMarkup">
  <meta property="og:title" content="${escapeHtml(page.name)} | SEOMarkup">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${origin}/assets/seomarkup-og.png">
  <meta property="og:image:alt" content="SEOMarkup schema, SEO, social metadata and tracking report">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(page.name)} | SEOMarkup">
  <meta name="twitter:description" content="${escapeHtml(page.description)}">
  <meta name="twitter:image" content="${origin}/assets/seomarkup-og.png">
  <link rel="stylesheet" href="/assets/site.css?v=0.3.1">
  <script type="application/ld+json">${structuredData(page)}</script>
</head>
<body class="seo-checker-page">
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="SEOMarkup home"><img src="/assets/icon.svg" width="34" height="34" alt=""><span>SEO<strong>Markup</strong></span></a>
    <nav aria-label="Primary navigation"><a href="#check">Check a URL</a><a href="#guide">Guide</a><a href="/privacy/">Privacy</a><a class="nav-download" href="/downloads/seomarkup-v0.1.0.zip" download>Download extension</a></nav>
  </header>
  <main id="main">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">SEOMarkup</a><span aria-hidden="true">/</span><span>${escapeHtml(page.name)}</span></nav>
    <section class="seo-checker-hero" aria-labelledby="page-title">
      <div class="seo-checker-copy">
        <h1 id="page-title">${escapeHtml(page.name)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <ul class="seo-proof-list"><li>Free to use</li><li>No account</li><li>No saved reports</li><li>No analytics</li></ul>
      </div>
      <div class="inspection-console seo-page-console" id="check">
        <form class="url-form" id="urlInspectorForm">
          <label for="inspectionUrl">Public page URL</label>
          <div class="url-control"><input id="inspectionUrl" name="url" type="text" inputmode="url" autocomplete="url" spellcheck="false" placeholder="example.com/page" maxlength="2048" required><button id="inspectUrlButton" type="submit"><span id="inspectUrlButtonLabel">Check URL</span></button></div>
          <label class="image-load-option" for="loadPreviewImagesOption"><input id="loadPreviewImagesOption" type="checkbox" checked><span><strong>Load declared social images</strong><small>Requested directly from their source with no referrer when you open the Social tab.</small></span></label>
        </form>
        <div class="fetch-receipt" aria-label="Website check privacy summary"><span><b>1</b> page fetched</span><span><b>0</b> reports saved</span><span><b>0</b> analytics events</span></div>
        <p class="inspection-explainer">Your URL is sent to BusinessPress for this one-time source check. We do not save the page or report.</p>
        <p class="inspection-status" id="inspectionStatus" role="status" aria-live="polite">Enter a public URL to start.</p>
      </div>
    </section>
    ${reportMarkup()}
    <section class="seo-guide" id="guide" aria-labelledby="guide-title">
      <div class="seo-guide-intro"><h2 id="guide-title">What this check covers</h2><p>${escapeHtml(page.summary)}</p></div>
      <ul class="seo-coverage-list">${page.checks.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <div class="seo-review-list">${page.review.map(([title, copy]) => `<article><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p></article>`).join('')}</div>
    </section>
    <section class="seo-boundary" aria-labelledby="boundary-title"><h2 id="boundary-title">Source check or rendered check?</h2><div><p><strong>Use this page</strong> for one public URL and the markup returned in its source HTML.</p><p><strong>Use the Chrome extension</strong> for a rendered tab, JavaScript-added markup, loaded-resource evidence, private pages and a fully local report.</p></div><a class="button button-primary" href="/downloads/seomarkup-v0.1.0.zip" download>Download the local extension</a></section>
    <section class="seo-faq" aria-labelledby="faq-title"><h2 id="faq-title">Questions about ${escapeHtml(page.name.toLowerCase())}</h2><div>${page.faq.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</div></section>
    <section class="related-checkers" aria-labelledby="related-title"><h2 id="related-title">Related checks</h2><nav aria-label="Related SEOMarkup checkers">${related.map((item) => `<a href="/${item.slug}/"><span>${escapeHtml(item.name)}</span><small>${escapeHtml(item.description)}</small></a>`).join('')}</nav></section>
  </main>
  <footer><div class="brand footer-brand"><img src="/assets/icon.svg" width="28" height="28" alt=""><span>SEO<strong>Markup</strong></span></div>${poweredByMarkup()}<nav aria-label="Footer navigation"><a href="/">All checks</a><a href="/sitemap/">Sitemap</a><a href="/privacy/">Privacy</a><a href="https://tools.businesspress.io/">BusinessPress Tools</a><a href="https://github.com/eim-solutions/schema.businesspress.io">GitHub</a></nav></footer>
  <script src="/assets/analyzer.js?v=0.2.0"></script>
  <script src="/assets/report-share.js?v=0.1.0"></script>
  <script src="/assets/web-inspector.js?v=0.3.0"></script>
</body>
</html>
`;
}

function renderHtmlSitemap() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sitemap — All SEOMarkup Checkers and Pages</title>
  <meta name="description" content="Browse every SEOMarkup schema, structured data, social preview, meta tag and tracking checker from one page.">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#1447e6">
  <link rel="canonical" href="${origin}/sitemap/">
  <link rel="icon" href="/favicon.png" sizes="32x32">
  <link rel="stylesheet" href="/assets/site.css?v=0.3.1">
  <script type="application/ld+json">${sitemapStructuredData()}</script>
</head>
<body class="sitemap-page">
  <!--
    THESIS: A complete, scannable index replaces hunting through navigation.
    OWN-WORLD: White evidence surfaces, deep ink type, cobalt links, and precise rules.
    STORY: See every public SEOMarkup page, choose the relevant check, and open it directly.
    FIRST VIEWPORT: Compact header, direct title and grouped link index with no decorative detours.
    FORM: Read-mode index extending the established SEOMarkup system; seed key: precise-sitemap-index.
    FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
  -->
  <a class="skip-link" href="#main">Skip to content</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="SEOMarkup home"><img src="/assets/icon.svg" width="34" height="34" alt=""><span>SEO<strong>Markup</strong></span></a>
    <nav aria-label="Primary navigation"><a href="/">Product</a><a href="/privacy/">Privacy</a><a class="nav-download" href="/downloads/seomarkup-v0.1.0.zip" download>Download extension</a></nav>
  </header>
  <main id="main" class="sitemap-shell">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">SEOMarkup</a><span aria-hidden="true">/</span><span>Sitemap</span></nav>
    <header class="sitemap-intro">
      <h1>Find the right check.</h1>
      <p>Open any SEOMarkup checker or information page directly.</p>
    </header>
    <section class="sitemap-group" aria-labelledby="checker-pages-title">
      <h2 id="checker-pages-title">Checker pages</h2>
      <nav class="sitemap-links" aria-label="SEOMarkup checker pages">
        ${pages.map((page) => `<a href="/${page.slug}/"><span>${escapeHtml(page.name)}</span><small>${escapeHtml(page.description)}</small></a>`).join('')}
      </nav>
    </section>
    <section class="sitemap-group" aria-labelledby="site-pages-title">
      <h2 id="site-pages-title">Site information</h2>
      <nav class="sitemap-links" aria-label="SEOMarkup information pages">
        <a href="/"><span>SEOMarkup home</span><small>Check a URL, review the extension, and download it for local inspection.</small></a>
        <a href="/privacy/"><span>Privacy policy</span><small>Understand the separate privacy boundaries for the website and Chrome extension.</small></a>
        <a href="/sitemap.xml"><span>XML sitemap</span><small>Open the machine-readable list of canonical SEOMarkup pages.</small></a>
      </nav>
    </section>
  </main>
  <footer><div class="brand footer-brand"><img src="/assets/icon.svg" width="28" height="28" alt=""><span>SEO<strong>Markup</strong></span></div>${poweredByMarkup()}<nav aria-label="Footer navigation"><a href="/">Product</a><a href="/sitemap/" aria-current="page">Sitemap</a><a href="/privacy/">Privacy</a><a href="https://tools.businesspress.io/">BusinessPress Tools</a></nav></footer>
</body>
</html>
`;
}

function sitemap() {
  const urls = ['', 'privacy', 'sitemap', ...pages.map((page) => page.slug)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((slug) => `  <url>\n    <loc>${origin}/${slug ? `${slug}/` : ''}</loc>\n    <lastmod>${updated}</lastmod>\n  </url>`).join('\n')}\n</urlset>\n`;
}

function writeOrCheck(file, content) {
  if (checkMode) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      throw new Error(`${path.relative(root, file)} is out of date. Run npm run build:seo.`);
    }
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

for (const page of pages) writeOrCheck(path.join(publicRoot, page.slug, 'index.html'), renderPage(page));
writeOrCheck(path.join(publicRoot, 'sitemap', 'index.html'), renderHtmlSitemap());
writeOrCheck(path.join(publicRoot, 'sitemap.xml'), sitemap());

console.log(`${checkMode ? 'Verified' : 'Built'} ${pages.length} checker pages, HTML sitemap, and XML sitemap.`);
