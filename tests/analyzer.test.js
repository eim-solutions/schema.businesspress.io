'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const analyzer = require('../extension/analyzer.js');

function snapshot(overrides = {}) {
  return {
    url: 'https://example.com/guides/schema?private=remove-me#section',
    documentTitle: 'A practical guide to structured data',
    titleElements: ['A practical guide to structured data'],
    htmlLang: 'en',
    metas: [
      { name: 'description', property: '', httpEquiv: '', content: 'A complete practical guide to inspecting structured data, social previews, and technical SEO markup on a web page.' },
      { name: 'viewport', property: '', httpEquiv: '', content: 'width=device-width, initial-scale=1' },
      { name: 'robots', property: '', httpEquiv: '', content: 'index,follow' },
      { name: '', property: 'og:title', httpEquiv: '', content: 'Structured data guide' },
      { name: '', property: 'og:description', httpEquiv: '', content: 'Inspect the markup that search engines and social platforms read.' },
      { name: '', property: 'og:image', httpEquiv: '', content: '/social/schema-guide.png' },
      { name: '', property: 'og:image:alt', httpEquiv: '', content: 'Structured data markup shown in an inspector' },
      { name: '', property: 'og:url', httpEquiv: '', content: 'https://example.com/guides/schema' },
      { name: '', property: 'og:type', httpEquiv: '', content: 'article' },
      { name: 'twitter:card', property: '', httpEquiv: '', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'canonical', href: 'https://example.com/guides/schema', hreflang: '', type: '' },
      { rel: 'alternate', href: '/lt/gidai/schema', hreflang: 'lt', type: '' },
    ],
    headings: { h1: ['A practical guide to structured data'], h2: ['What it checks'] },
    images: [{ src: '/social/schema-guide.png', hasAlt: true, alt: 'Structured data markup shown in an inspector', width: 1200, height: 630 }],
    scripts: [],
    iframes: [],
    noscripts: [],
    performanceEntries: [],
    microdataItems: [],
    rdfaItems: [],
    ...overrides,
  };
}

test('extracts JSON-LD graph types and keeps page URLs free of query data', () => {
  const report = analyzer.analyzeSnapshot(snapshot({
    scripts: [{
      type: 'application/ld+json',
      src: '',
      text: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebPage', '@id': 'https://example.com/guides/schema#page', name: 'Guide' },
          { '@type': ['Article', 'TechArticle'], '@id': 'https://example.com/guides/schema#article', headline: 'Guide' },
        ],
      }),
    }],
  }));

  assert.equal(report.page.url, 'https://example.com/guides/schema');
  assert.equal(report.summary.schemaItems, 2);
  assert.deepEqual(report.structuredData.types, ['Article', 'TechArticle', 'WebPage']);
  assert.equal(report.structuredData.jsonLd[0].valid, true);
  assert.equal(report.summary.errors, 0);
});

test('reports malformed JSON-LD as an error without stopping other checks', () => {
  const report = analyzer.analyzeSnapshot(snapshot({
    scripts: [{ type: 'application/ld+json', src: '', text: '{"@context":"https://schema.org","@type":"Article",}' }],
  }));

  assert.equal(report.structuredData.jsonLd[0].valid, false);
  assert.equal(report.summary.errors, 1);
  assert.match(report.issues[0].title, /invalid JSON/);
  assert.equal(report.seo.fields.find((item) => item.label === 'Canonical').status, 'good');
});

test('finds duplicate identifiers across JSON-LD blocks', () => {
  const sharedId = 'https://example.com/#organization';
  const report = analyzer.analyzeSnapshot(snapshot({
    scripts: [
      { type: 'application/ld+json', src: '', text: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', '@id': sharedId }) },
      { type: 'application/ld+json', src: '', text: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Organization', '@id': sharedId }) },
    ],
  }));

  assert.ok(report.issues.some((item) => item.title === 'Duplicate @id found'));
});

test('detects SEO gaps and noindex without presenting length guidance as an error', () => {
  const report = analyzer.analyzeSnapshot(snapshot({
    titleElements: [],
    documentTitle: '',
    htmlLang: '',
    metas: [{ name: 'robots', property: '', httpEquiv: '', content: 'noindex,nofollow' }],
    links: [],
    headings: { h1: [], h2: [] },
    images: [{ src: '/photo.jpg', hasAlt: false, alt: '', width: 800, height: 600 }],
  }));

  assert.equal(report.seo.noindex, true);
  assert.ok(report.issues.some((item) => item.severity === 'error' && item.title === 'Page title is missing'));
  assert.ok(report.issues.some((item) => item.title === 'Images without alt attributes found'));
  assert.ok(report.summary.needsAttention >= 6);
});

test('uses Open Graph values as X/Twitter fallbacks', () => {
  const report = analyzer.analyzeSnapshot(snapshot());
  const twitterTitle = report.social.fields.find((item) => item.label === 'twitter:title');
  const previews = Object.fromEntries(report.social.previews.map((preview) => [preview.id, preview]));

  assert.equal(twitterTitle.status, 'good');
  assert.equal(twitterTitle.note, 'Open Graph fallback available');
  assert.equal(report.social.openGraph.image, 'https://example.com/social/schema-guide.png');
  assert.deepEqual(report.social.previews.map((preview) => preview.id), ['google', 'facebook', 'x', 'linkedin']);
  assert.equal(previews.google.title, 'A practical guide to structured data');
  assert.equal(previews.google.url, 'https://example.com/guides/schema');
  assert.equal(previews.facebook.image, 'https://example.com/social/schema-guide.png');
  assert.equal(previews.x.title, 'Structured data guide');
  assert.equal(previews.x.image, 'https://example.com/social/schema-guide.png');
  assert.equal(previews.x.card, 'summary_large_image');
  assert.equal(previews.linkedin.title, 'Structured data guide');
});

test('detects common trackers from tags, inline signatures, pixels, and loaded resources', () => {
  const report = analyzer.analyzeSnapshot(snapshot({
    scripts: [
      { type: '', src: 'https://www.googletagmanager.com/gtm.js?id=GTM-SECRET', text: '' },
      { type: '', src: 'https://connect.facebook.net/en_US/fbevents.js', text: '' },
      { type: '', src: '', text: "window.plausible = window.plausible || function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}" },
    ],
    images: [{ src: 'https://www.facebook.com/tr?id=123456&ev=PageView', hasAlt: true, alt: '', width: 1, height: 1 }],
    performanceEntries: ['https://www.clarity.ms/collect?project=secret-value'],
  }));

  assert.deepEqual(report.tracking.map((item) => item.name), [
    'Google Tag Manager',
    'Meta Pixel',
    'Microsoft Clarity',
    'Plausible Analytics',
  ]);
  const gtmEvidence = report.tracking[0].evidence[0].value;
  assert.equal(gtmEvidence, 'https://www.googletagmanager.com/gtm.js?id=…');
  assert.doesNotMatch(JSON.stringify(report.tracking), /secret-value|GTM-SECRET|123456/);
});

test('keeps valid-looking page content as inert report text', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const report = analyzer.analyzeSnapshot(snapshot({
    documentTitle: hostile,
    titleElements: [hostile],
    scripts: [{ type: 'application/ld+json', src: '', text: JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: hostile }) }],
  }));

  assert.equal(report.page.title, hostile);
  assert.match(report.structuredData.jsonLd[0].formatted, /onerror=alert/);
});
