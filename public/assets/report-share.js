(function attachSEOMarkupReportShare(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SEOMarkupReportShare = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createReportShareCodec() {
  'use strict';

  const VERSION = 'v1';
  const MAX_TOKEN_LENGTH = 160000;
  const MAX_PLAIN_BYTES = 2000000;
  const MAX_JSON_LD_BLOCKS = 20;
  const MAX_JSON_LD_TEXT = 16000;

  function cleanText(value, maxLength = 20000) {
    return String(value == null ? '' : value).slice(0, maxLength);
  }

  function cleanList(value, maxItems, mapper) {
    return (Array.isArray(value) ? value : []).slice(0, maxItems).map(mapper);
  }

  function cleanNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  }

  function compactFields(fields) {
    return cleanList(fields, 100, (field) => ({
      label: cleanText(field && field.label, 160),
      value: cleanText(field && field.value, 4000),
      status: ['good', 'warning', 'error', 'info'].includes(field && field.status) ? field.status : 'info',
      note: cleanText(field && field.note, 1000),
    }));
  }

  function compactReport(report) {
    const pageUrl = safeHttpUrl(report && report.page && report.page.url);
    if (!pageUrl) throw new Error('This report does not have a shareable public page URL.');

    const source = report || {};
    const summary = source.summary || {};
    const structuredData = source.structuredData || {};
    const social = source.social || {};
    const scan = source.scan || {};

    return {
      generatedAt: cleanText(source.generatedAt, 80),
      page: {
        url: pageUrl,
        title: cleanText(source.page && source.page.title, 500) || '(Untitled page)',
      },
      summary: {
        schemaItems: cleanNumber(summary.schemaItems),
        needsAttention: cleanNumber(summary.needsAttention),
        errors: cleanNumber(summary.errors),
        warnings: cleanNumber(summary.warnings),
        informational: cleanNumber(summary.informational),
        trackers: cleanNumber(summary.trackers),
        networkRequestsSentByExtension: 0,
      },
      structuredData: {
        types: cleanList(structuredData.types, 100, (type) => cleanText(type, 240)),
        jsonLd: cleanList(structuredData.jsonLd, MAX_JSON_LD_BLOCKS, (block, index) => ({
          index: cleanNumber(block && block.index) || index + 1,
          types: cleanList(block && block.types, 50, (type) => cleanText(type, 240)),
          entityCount: cleanNumber(block && block.entityCount),
          valid: Boolean(block && block.valid),
          issues: cleanList(block && block.issues, 30, (issue) => cleanText(issue, 1000)),
          formatted: cleanText((block && (block.formatted || block.raw)) || '', MAX_JSON_LD_TEXT),
          raw: '',
          truncated: Boolean(block && block.truncated),
        })),
        microdata: [],
        rdfa: [],
      },
      seo: { fields: compactFields(source.seo && source.seo.fields) },
      social: {
        fields: compactFields(social.fields),
        previews: cleanList(social.previews, 8, (preview) => ({
          id: ['google', 'facebook', 'x', 'linkedin'].includes(preview && preview.id) ? preview.id : 'facebook',
          label: cleanText(preview && preview.label, 80),
          title: cleanText(preview && preview.title, 500),
          description: cleanText(preview && preview.description, 1200),
          url: safeHttpUrl(preview && preview.url) || pageUrl,
          siteName: cleanText(preview && preview.siteName, 300),
          image: safeHttpUrl(preview && preview.image),
          imageAlt: cleanText(preview && preview.imageAlt, 500),
          card: cleanText(preview && preview.card, 80),
        })),
      },
      tracking: cleanList(source.tracking, 80, (tracker) => ({
        name: cleanText(tracker && tracker.name, 200),
        category: cleanText(tracker && tracker.category, 120),
        confidence: cleanText(tracker && tracker.confidence, 40),
        evidence: cleanList(tracker && tracker.evidence, 4, (item) => ({
          kind: cleanText(item && item.kind, 80),
          value: cleanText(item && item.value, 1000),
        })),
      })),
      issues: cleanList(source.issues, 200, (issue) => ({
        severity: ['error', 'warning', 'info'].includes(issue && issue.severity) ? issue.severity : 'info',
        area: cleanText(issue && issue.area, 120),
        title: cleanText(issue && issue.title, 500),
        detail: cleanText(issue && issue.detail, 1600),
      })),
      scan: {
        mode: 'Shared source report',
        requestedUrl: pageUrl,
        status: cleanNumber(scan.status),
        bytes: cleanNumber(scan.bytes),
        fetchedAt: cleanText(scan.fetchedAt || source.generatedAt, 80),
        retention: 'Contained in this link; not stored by SEOMarkup',
      },
      limitations: cleanList(source.limitations, 20, (item) => cleanText(item, 1200)),
    };
  }

  function bytesToBase64Url(bytes) {
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
  }

  function base64UrlToBytes(value) {
    const normalized = String(value || '').replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function compressBytes(bytes) {
    if (typeof globalThis.CompressionStream !== 'function') return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function decompressBytes(bytes) {
    if (typeof globalThis.DecompressionStream !== 'function') return null;
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = [];
    let total = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_PLAIN_BYTES) {
          await reader.cancel();
          throw new Error('This shared report expands beyond the safe size limit.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const output = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return output;
  }

  async function encodeReport(report) {
    const json = JSON.stringify({ version: 1, report: compactReport(report) });
    const plainBytes = new TextEncoder().encode(json);
    if (plainBytes.byteLength > MAX_PLAIN_BYTES) throw new Error('This report is too large to share as a link. Download the JSON report instead.');
    const compressed = await compressBytes(plainBytes);
    const token = compressed
      ? `${VERSION}.g.${bytesToBase64Url(compressed)}`
      : `${VERSION}.j.${bytesToBase64Url(plainBytes)}`;
    if (token.length > MAX_TOKEN_LENGTH) throw new Error('This report is too large to share as a link. Download the JSON report instead.');
    return token;
  }

  async function decodeReport(token) {
    const match = String(token || '').match(/^v1\.(g|j)\.([A-Za-z0-9_-]+)$/u);
    if (!match || token.length > MAX_TOKEN_LENGTH) throw new Error('This share link is invalid or unsupported.');
    try {
      const encodedBytes = base64UrlToBytes(match[2]);
      const plainBytes = match[1] === 'g' ? await decompressBytes(encodedBytes) : encodedBytes;
      if (!plainBytes) throw new Error('This browser cannot open compressed report links.');
      if (plainBytes.byteLength > MAX_PLAIN_BYTES) throw new Error('This shared report expands beyond the safe size limit.');
      const payload = JSON.parse(new TextDecoder().decode(plainBytes));
      if (!payload || payload.version !== 1 || !payload.report) throw new Error('Invalid payload.');
      return compactReport(payload.report);
    } catch (error) {
      if (error && /cannot open compressed|safe size limit/i.test(error.message || '')) throw error;
      throw new Error('This share link is invalid or unsupported.');
    }
  }

  return { compactReport, decodeReport, encodeReport, safeHttpUrl };
}));
