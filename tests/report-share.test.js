'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const share = require('../public/assets/report-share.js');

function sampleReport() {
  return {
    generatedAt: '2026-08-11T06:00:00.000Z',
    page: { url: 'https://example.com/guide?private=value', title: 'Schema guide' },
    summary: { schemaItems: 2, needsAttention: 1, errors: 0, warnings: 1, informational: 2, trackers: 1 },
    structuredData: {
      types: ['Article', 'Organization'],
      jsonLd: [{ index: 1, types: ['Article'], entityCount: 2, valid: true, issues: [], formatted: '{"@type":"Article"}' }],
    },
    seo: { fields: [{ label: 'title', value: 'Schema guide', status: 'good', note: '' }] },
    social: {
      fields: [{ label: 'og:image', value: 'https://example.com/share.jpg', status: 'good', note: '' }],
      previews: [{ id: 'facebook', label: 'Facebook', title: 'Schema guide', description: 'A useful guide', url: 'https://example.com/guide', siteName: 'Example', image: 'https://example.com/share.jpg', imageAlt: 'Share image', card: 'summary_large_image' }],
    },
    tracking: [{ name: 'Example analytics', category: 'Analytics', confidence: 'High', evidence: [{ kind: 'Script', value: 'https://example.com/collect?id=…' }] }],
    issues: [{ severity: 'warning', area: 'SEO', title: 'Review title', detail: 'Check the title.' }],
    scan: { status: 200, bytes: 1234, fetchedAt: '2026-08-11T06:00:00.000Z' },
    limitations: ['Source HTML only.'],
  };
}

test('encodes and restores a complete shareable report without server storage', async () => {
  const token = await share.encodeReport(sampleReport());
  const restored = await share.decodeReport(token);

  assert.match(token, /^v1\.(?:g|j)\.[A-Za-z0-9_-]+$/);
  assert.equal(restored.page.url, 'https://example.com/guide?private=value');
  assert.equal(restored.summary.schemaItems, 2);
  assert.equal(restored.structuredData.jsonLd[0].types[0], 'Article');
  assert.equal(restored.social.previews[0].image, 'https://example.com/share.jpg');
  assert.equal(restored.scan.mode, 'Shared source report');
  assert.equal(restored.scan.retention, 'Contained in this link; not stored by SEOMarkup');
});

test('rejects unsafe page URLs and invalid share tokens', async () => {
  assert.throws(() => share.compactReport({ page: { url: 'javascript:alert(1)' } }), /shareable public page URL/);
  await assert.rejects(() => share.decodeReport('v1.g.not-valid-gzip'), /invalid|unsupported|compressed|incorrect|header|data/i);
});

test('limits large JSON-LD blocks before creating the share URL', () => {
  const report = sampleReport();
  report.structuredData.jsonLd[0].formatted = 'x'.repeat(50000);
  const compact = share.compactReport(report);
  assert.equal(compact.structuredData.jsonLd[0].formatted.length, 16000);
});

test('rejects compressed share links that expand beyond the safe report limit', async () => {
  const compressed = zlib.gzipSync(Buffer.alloc(2000001, 97));
  const token = `v1.g.${compressed.toString('base64url')}`;

  await assert.rejects(() => share.decodeReport(token), /safe size limit/i);
});
