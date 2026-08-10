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

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('publishes canonical search and social metadata', () => {
  assert.match(home, /<title>SEOMarkup — Private Schema, SEO & Tracking Inspector<\/title>/);
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

test('keeps the public site free of analytics and remote scripts', () => {
  const source = `${home}\n${privacy}`;
  assert.doesNotMatch(source, /<script[^>]+src=/i);
  assert.doesNotMatch(source, /<(?:img|iframe)[^>]+src=["']https?:/i);
  assert.doesNotMatch(source, /<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i);
  assert.doesNotMatch(source, /\b(?:gtag|fbq|plausible|clarity|hj)\s*\(/i);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
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
  assert.match(home, /class="skip-link"/);
  assert.match(home, /aria-label="Primary navigation"/);
});

test('publishes robots and sitemap discovery', () => {
  const robots = fs.readFileSync(path.join(publicRoot, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(publicRoot, 'sitemap.xml'), 'utf8');

  assert.match(robots, /Sitemap: https:\/\/schema\.businesspress\.io\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/schema\.businesspress\.io\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/schema\.businesspress\.io\/privacy\/<\/loc>/);
});
