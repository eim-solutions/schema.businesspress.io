'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const publicRoot = path.join(root, 'public');
const home = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');
const privacy = fs.readFileSync(path.join(publicRoot, 'privacy', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(publicRoot, 'assets', 'site.css'), 'utf8');
const checkerSlugs = [
  'schema-markup-checker',
  'structured-data-checker',
  'json-ld-validator',
  'social-media-preview-checker',
  'open-graph-checker',
  'twitter-card-checker',
  'meta-tag-checker',
  'tracking-pixel-checker',
];
const checkerPages = checkerSlugs.map((slug) => ({
  slug,
  html: fs.readFileSync(path.join(publicRoot, slug, 'index.html'), 'utf8'),
}));

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('publishes canonical search and social metadata', () => {
  assert.match(home, /<title>SEOMarkup — Check Schema, SEO & Tracking Tags<\/title>/);
  assert.match(home, /<link rel="canonical" href="https:\/\/schema\.businesspress\.io\/">/);
  assert.match(home, /property="og:image" content="https:\/\/schema\.businesspress\.io\/assets\/seomarkup-og\.png"/);
  assert.match(home, /name="twitter:card" content="summary_large_image"/);
  assert.match(privacy, /<link rel="canonical" href="https:\/\/schema\.businesspress\.io\/privacy\/">/);
});

test('publishes valid SoftwareApplication JSON-LD without invented ratings', () => {
  const match = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'JSON-LD block should exist');
  const schema = JSON.parse(match[1]);

  assert.equal(schema['@type'], 'SoftwareApplication');
  assert.equal(schema.name, 'SEOMarkup Structured Data Schema Inspector');
  assert.equal(schema.downloadUrl, 'https://schema.businesspress.io/downloads/seomarkup-v0.1.0.zip');
  assert.equal(schema.offers.price, '0');
  assert.equal('aggregateRating' in schema, false);
});

test('keeps the public site free of analytics and third-party page assets', () => {
  const source = `${home}\n${privacy}`;
  assert.doesNotMatch(source, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(source, /<(?:img|iframe)[^>]+src=["']https?:/i);
  assert.doesNotMatch(source, /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i);
  assert.doesNotMatch(source, /\b(?:gtag|fbq|plausible|clarity|hj)\s*\(/i);
  assert.doesNotMatch(source, /XMLHttpRequest|sendBeacon|WebSocket/);
});

test('publishes the URL inspector and explicit server-fetch boundary', () => {
  assert.match(home, /id="urlInspectorForm"/);
  assert.match(home, /id="browserReport"/);
  assert.match(home, /Your URL is sent to BusinessPress for this one-time check/i);
  assert.match(home, /src="\/assets\/analyzer\.js\?v=[^"]+"/);
  assert.match(home, /src="\/assets\/web-inspector\.js\?v=[^"]+"/);
  assert.match(privacy, /Website URL inspection/);
});

test('serves the reviewed analyzer unchanged to the website', () => {
  assert.equal(
    sha256(path.join(root, 'extension', 'analyzer.js')),
    sha256(path.join(publicRoot, 'assets', 'analyzer.js')),
  );
});

test('web inspector renders with safe DOM APIs and sends URL by POST', () => {
  const inspector = fs.readFileSync(path.join(publicRoot, 'assets', 'web-inspector.js'), 'utf8');
  assert.match(inspector, /method: 'POST'/);
  assert.match(inspector, /body: JSON\.stringify\(\{ url: submittedUrl \}\)/);
  assert.match(inspector, /new DOMParser\(\)/);
  assert.match(inspector, /textContent =/);
  assert.match(inspector, /'google'.*'facebook'.*'x'.*'linkedin'|preview\.id/s);
  assert.match(inspector, /Load preview images/);
  assert.match(inspector, /referrerPolicy = 'no-referrer'/);
  assert.match(inspector, /preview\.card === 'summary'/);
  assert.match(inspector, /Image declared — not loaded/);
  assert.doesNotMatch(inspector, /\.innerHTML\s*=|\beval\s*\(|new Function/);
});

test('server fetch endpoint has SSRF, redirect, size, and timeout guards', () => {
  const endpoint = fs.readFileSync(path.join(publicRoot, 'api', 'inspect.php'), 'utf8');
  assert.match(endpoint, /FILTER_FLAG_NO_PRIV_RANGE \| FILTER_FLAG_NO_RES_RANGE/);
  assert.match(endpoint, /CURLOPT_RESOLVE/);
  assert.match(endpoint, /CURLOPT_FOLLOWLOCATION => false/);
  assert.match(endpoint, /SEOMARKUP_MAX_BODY_BYTES = 2_000_000/);
  assert.match(endpoint, /CURLOPT_CONNECTTIMEOUT => 5/);
  assert.match(endpoint, /CURLOPT_TIMEOUT => 12/);
  assert.match(endpoint, /standard web port 80 or 443/);
  assert.match(endpoint, /Remove login details from the URL/);
});

test('ships every linked local asset and download', () => {
  const localPaths = [...home.matchAll(/(?:href|src)="(\/(?!\/)[^"#?]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value !== '/');

  localPaths.forEach((urlPath) => {
    const normalized = urlPath.endsWith('/') ? `${urlPath}index.html` : urlPath;
    assert.equal(fs.existsSync(path.join(publicRoot, normalized)), true, `${urlPath} should exist`);
  });
});

test('serves the same reviewed archive from dist and public', () => {
  const dist = path.join(root, 'dist', 'seomarkup-v0.1.0.zip');
  const download = path.join(publicRoot, 'downloads', 'seomarkup-v0.1.0.zip');
  assert.equal(fs.existsSync(dist), true);
  assert.equal(fs.existsSync(download), true);
  assert.equal(sha256(dist), sha256(download));
});

test('includes responsive, focus, and reduced-motion paths', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*footer\s*{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*footer nav\s*{[^}]*flex-wrap:\s*wrap;/s);
  assert.match(home, /class="skip-link"/);
  assert.match(home, /aria-label="Primary navigation"/);
});

test('uses a local icon system and visible hero privacy checks', () => {
  assert.match(home, /<symbol id="icon-check"/);
  assert.match(home, /class="hero-trust"/);
  assert.match(home, /id="inspectUrlButtonLabel">Check URL/);
  assert.match(home, /Free to use/);
  assert.match(home, /No account/);
  assert.match(home, /No analytics/);
  assert.match(home, /No saved reports/);
  assert.doesNotMatch(home, /class="check-token">(?:\{ \}|Aa|↗|◎)/);
});

test('publishes robots and sitemap discovery', () => {
  const robots = fs.readFileSync(path.join(publicRoot, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');
  const htmlSitemap = fs.readFileSync(path.join(publicRoot, 'sitemap', 'index.html'), 'utf8');
  const llms = fs.readFileSync(path.join(publicRoot, 'llms.txt'), 'utf8');

  assert.match(robots, /Sitemap: https:\/\/schema\.businesspress\.io\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/schema\.businesspress\.io\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/schema\.businesspress\.io\/privacy\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/schema\.businesspress\.io\/sitemap\/<\/loc>/);
  assert.match(htmlSitemap, /<link rel="canonical" href="https:\/\/schema\.businesspress\.io\/sitemap\/">/);
  assert.match(htmlSitemap, /href="\/sitemap\.xml"/);
  checkerSlugs.forEach((slug) => {
    assert.match(sitemap, new RegExp(`<loc>https://schema\\.businesspress\\.io/${slug}/</loc>`));
    assert.match(llms, new RegExp(`https://schema\\.businesspress\\.io/${slug}/`));
    assert.match(htmlSitemap, new RegExp(`href="/${slug}/"`));
  });
  assert.match(home, /<footer>[\s\S]*href="\/sitemap\/"/);
  assert.match(privacy, /<footer>[\s\S]*href="\/sitemap\/"/);
  assert.match(llms, /does not provide an SEO score/i);
});

test('publishes useful focused checker pages with unique metadata and the working inspector', () => {
  const titles = new Set();
  const descriptions = new Set();

  checkerPages.forEach(({ slug, html }) => {
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
    assert.ok(title, `${slug} should have a title`);
    assert.ok(description, `${slug} should have a description`);
    titles.add(title);
    descriptions.add(description);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://schema\\.businesspress\\.io/${slug}/">`));
    assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
    assert.match(html, /id="urlInspectorForm"/);
    assert.match(html, /id="browserReport"/);
    assert.match(html, /What this check covers/);
    assert.match(html, /Source check or rendered check\?/);
    assert.match(html, /Related checks/);

    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(match, `${slug} should have JSON-LD`);
    const graph = JSON.parse(match[1])['@graph'];
    assert.ok(graph.some((item) => item['@type'] === 'WebPage'));
    assert.ok(graph.some((item) => item['@type'] === 'BreadcrumbList'));
    assert.ok(graph.some((item) => item['@type'] === 'SoftwareApplication'));
  });

  assert.equal(titles.size, checkerPages.length);
  assert.equal(descriptions.size, checkerPages.length);
});

test('homepage links to every focused checker and BusinessPress Tools', () => {
  checkerSlugs.forEach((slug) => assert.match(home, new RegExp(`href="/${slug}/"`)));
  assert.match(home, /href="https:\/\/tools\.businesspress\.io\/"/);
});
