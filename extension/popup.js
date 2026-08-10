'use strict';

const elements = {
  loading: document.getElementById('loadingView'),
  error: document.getElementById('errorView'),
  results: document.getElementById('resultsView'),
  footer: document.getElementById('footerActions'),
  errorTitle: document.getElementById('errorTitle'),
  errorMessage: document.getElementById('errorMessage'),
  pageOrigin: document.getElementById('pageOrigin'),
  pageTitle: document.getElementById('pageTitle'),
  pagePath: document.getElementById('pagePath'),
  schemaCount: document.getElementById('schemaCount'),
  issueCount: document.getElementById('issueCount'),
  trackerCount: document.getElementById('trackerCount'),
  schemaTabCount: document.getElementById('schemaTabCount'),
  trackingTabCount: document.getElementById('trackingTabCount'),
  toast: document.getElementById('toast'),
};

const panels = {
  overview: document.getElementById('panel-overview'),
  schema: document.getElementById('panel-schema'),
  seo: document.getElementById('panel-seo'),
  social: document.getElementById('panel-social'),
  tracking: document.getElementById('panel-tracking'),
};

let currentReport = null;
let toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  setupInteractions();
  if (new URLSearchParams(window.location.search).get('demo') === '1') {
    currentReport = createDemoReport();
    renderReport(currentReport);
    showView('results');
  } else {
    scanActivePage();
  }
});

function setupInteractions() {
  document.getElementById('rescanButton').addEventListener('click', scanActivePage);
  document.getElementById('retryButton').addEventListener('click', scanActivePage);
  document.getElementById('copySummaryButton').addEventListener('click', copySummary);
  document.getElementById('exportButton').addEventListener('click', exportReport);

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex].dataset.tab);
    });
  });
}

function activateTab(name) {
  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  Object.entries(panels).forEach(([panelName, panel]) => {
    const active = panelName === name;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

async function scanActivePage() {
  showView('loading');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error('No active tab is available.');
    if (/^(chrome|edge|about|devtools|chrome-extension):/i.test(tab.url || '')) {
      throw new Error('Chrome protects this page from extensions. Open a regular website and try again.');
    }

    const executionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['analyzer.js'],
    });
    const report = executionResults && executionResults[0] && executionResults[0].result;
    if (!report || !report.summary) throw new Error('The page returned no readable markup.');

    currentReport = report;
    renderReport(report);
    showView('results');
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const blocked = /Cannot access|protected|chrome:\/\/|permission|extensions gallery/i.test(message);
    elements.errorTitle.textContent = blocked ? 'Chrome protects this page' : 'This page could not be inspected';
    elements.errorMessage.textContent = blocked
      ? 'Open a regular website, then click SEOMarkup again.'
      : message.replace(/^Error:\s*/i, '') || 'Reload the page and try again.';
    showView('error');
  }
}

function showView(name) {
  elements.loading.classList.toggle('hidden', name !== 'loading');
  elements.error.classList.toggle('hidden', name !== 'error');
  elements.results.classList.toggle('hidden', name !== 'results');
  elements.footer.classList.toggle('hidden', name !== 'results');
}

function renderReport(report) {
  const pageUrl = parseUrl(report.page.url);
  elements.pageOrigin.textContent = pageUrl ? pageUrl.hostname : 'Current page';
  elements.pageTitle.textContent = report.page.title;
  elements.pageTitle.title = report.page.title;
  elements.pagePath.textContent = pageUrl ? pageUrl.pathname : report.page.url;
  elements.pagePath.title = report.page.url;
  elements.schemaCount.textContent = report.summary.schemaItems;
  elements.issueCount.textContent = report.summary.needsAttention;
  elements.trackerCount.textContent = report.summary.trackers;
  elements.schemaTabCount.textContent = report.summary.schemaItems;
  elements.trackingTabCount.textContent = report.summary.trackers;

  renderOverview(report);
  renderSchema(report);
  renderFieldsPanel(panels.seo, 'Search metadata', 'Rendered page values and practical checks', report.seo.fields);
  renderSocial(report);
  renderTracking(report);
  activateTab('overview');
}

function renderOverview(report) {
  const panel = resetPanel(panels.overview);
  const attentionIssues = report.issues.filter((item) => item.severity !== 'info');
  const infoIssues = report.issues.filter((item) => item.severity === 'info');

  const issueBlock = sectionBlock('Priority findings', `${report.summary.errors} errors · ${report.summary.warnings} warnings`);
  if (attentionIssues.length) {
    issueBlock.append(createIssueList(attentionIssues));
  } else {
    issueBlock.append(emptyState('No structural warnings found', 'The rendered markup passed SEOMarkup’s local checks. Search-engine eligibility still needs the relevant official testing tool.', true));
  }
  panel.append(issueBlock);

  const typeBlock = sectionBlock('Schema vocabulary', `${report.structuredData.types.length} distinct types`);
  if (report.structuredData.types.length) {
    const list = create('div', 'type-list');
    report.structuredData.types.forEach((type) => list.append(create('span', 'type-chip', type)));
    typeBlock.append(list);
  } else {
    typeBlock.append(emptyState('No Schema.org types found', 'Add JSON-LD, Microdata, or RDFa only when it accurately describes visible page content.'));
  }
  panel.append(typeBlock);

  if (infoIssues.length) {
    const guidanceBlock = sectionBlock('Useful notes', `${infoIssues.length} non-blocking observations`);
    guidanceBlock.append(createIssueList(infoIssues));
    panel.append(guidanceBlock);
  }
}

function renderSchema(report) {
  const panel = resetPanel(panels.schema);
  const jsonBlock = sectionBlock('JSON-LD', `${report.structuredData.jsonLd.length} blocks`);

  if (!report.structuredData.jsonLd.length) {
    jsonBlock.append(emptyState('No JSON-LD found', 'The page may still use Microdata or RDFa. SEOMarkup does not fetch markup injected after this scan.'));
  } else {
    report.structuredData.jsonLd.forEach((block) => {
      const details = create('details', 'schema-card');
      const summary = create('summary');
      const title = create('div', 'schema-title');
      title.append(
        create('strong', '', block.types.length ? block.types.join(', ') : `JSON-LD block ${block.index}`),
        create('span', '', `${block.entityCount || 0} ${block.entityCount === 1 ? 'entity' : 'entities'}${block.truncated ? ' · preview truncated' : ''}`),
      );
      summary.append(title, statusPill(block.valid && !block.issues.length ? 'Valid JSON' : block.valid ? 'Review' : 'Invalid', block.valid && !block.issues.length ? 'good' : block.valid ? 'warning' : 'error'));
      details.append(summary);

      const body = create('div', 'schema-body');
      if (block.issues.length) {
        const list = create('ul', 'schema-issues');
        block.issues.forEach((message) => list.append(create('li', '', message)));
        body.append(list);
      }
      if (block.contexts.length) body.append(createFieldRow('Context', block.contexts.join(' · '), 'good'));
      if (block.ids.length) body.append(createFieldRow('@id', block.ids.join(' · '), 'good', `${block.ids.length} identifiers`));

      const codeWrap = create('div', 'code-wrap');
      const code = create('pre', 'code-preview', block.formatted || block.raw || '(empty)');
      const copyButton = create('button', 'copy-code', 'Copy JSON');
      copyButton.type = 'button';
      copyButton.addEventListener('click', () => copyText(block.formatted || block.raw || '', 'JSON-LD copied'));
      codeWrap.append(code, copyButton);
      body.append(codeWrap);
      details.append(body);
      jsonBlock.append(details);
    });
  }
  panel.append(jsonBlock);

  panel.append(renderSecondarySchema('Microdata', report.structuredData.microdata));
  panel.append(renderSecondarySchema('RDFa', report.structuredData.rdfa));

  const note = create('div', 'note-card');
  note.append(create('strong', '', 'What “valid” means here'), create('p', '', 'SEOMarkup checks JSON parsing and common Schema.org structure locally. It does not claim Google rich-result eligibility or fetch external vocabularies.'));
  panel.append(note);
}

function renderSecondarySchema(name, items) {
  const block = sectionBlock(name, `${items.length} items`);
  if (!items.length) {
    block.append(emptyState(`No ${name} found`, `No rendered ${name} item declarations were detected.`));
    return block;
  }

  const list = create('div', 'field-list');
  items.forEach((item) => {
    const types = item.types && item.types.length ? item.types.join(', ') : 'Untyped item';
    list.append(createFieldRow(`#${item.index}`, types, item.types && item.types.length ? 'good' : 'warning', `${item.propertyCount} descendant properties${item.id ? ` · ${item.id}` : ''}`));
  });
  block.append(list);
  return block;
}

function renderFieldsPanel(panelElement, heading, description, fields) {
  const panel = resetPanel(panelElement);
  const block = sectionBlock(heading, description);
  const list = create('div', 'field-list');
  fields.forEach((item) => list.append(createFieldRow(item.label, item.value, item.status, item.note)));
  block.append(list);
  panel.append(block);
}

function renderSocial(report) {
  const panel = resetPanel(panels.social);
  const previews = report.social.previews || [];
  const previewBlock = sectionBlock('Share previews', 'Approximate previews from the current page. Platforms may crop or rewrite them.');
  const grid = create('div', 'social-preview-grid');
  previews.forEach((preview) => grid.append(createSocialPreview(preview, report.page.url)));

  if (previews.some((preview) => safePreviewImageUrl(preview.image))) {
    const controls = create('div', 'social-load-control');
    controls.append(create('p', '', 'Images stay blocked until you choose to load them. Chrome requests only the listed image URLs directly. SEOMarkup receives nothing.'));
    const loadButton = create('button', 'button button-secondary', 'Load preview images');
    loadButton.type = 'button';
    loadButton.addEventListener('click', () => loadPreviewImages(grid, loadButton));
    controls.append(loadButton);
    previewBlock.append(controls);
  }
  previewBlock.append(grid);
  panel.append(previewBlock);

  const tagsBlock = sectionBlock('Declared social tags', 'Open Graph and X/Twitter card values');
  const list = create('div', 'field-list');
  report.social.fields.forEach((item) => list.append(createFieldRow(item.label, item.value, item.status, item.note)));
  tagsBlock.append(list);
  panel.append(tagsBlock);
}

function createSocialPreview(preview, pageUrl) {
  const compactX = preview.id === 'x' && preview.card === 'summary';
  const card = create('article', `social-card social-${preview.id}${compactX ? ' social-compact' : ''}`);
  card.setAttribute('aria-label', `${preview.label} preview`);
  card.append(create('h3', 'social-platform', preview.label));

  if (preview.id !== 'google') {
    const media = create('div', 'social-media');
    const imageUrl = safePreviewImageUrl(preview.image);
    media.dataset.imageUrl = imageUrl;
    media.dataset.imageAlt = preview.imageAlt || `${preview.label} share image`;
    media.append(
      create('strong', '', imageUrl ? 'Image declared — not loaded' : 'No image declared'),
      create('span', '', imageUrl || 'Add an image tag to control this preview.'),
    );
    card.append(media);
  }

  const copy = create('div', 'social-card-copy');
  const url = parseUrl(preview.url || pageUrl);
  if (preview.id === 'google') {
    copy.append(
      create('span', 'google-site', preview.siteName || (url ? url.hostname : 'Website')),
      create('span', 'google-url', preview.url || pageUrl),
      create('p', 'social-preview-title', preview.title || '(Untitled page)'),
      create('p', '', preview.description || 'No meta description is declared.'),
    );
  } else {
    copy.append(
      create('small', '', preview.siteName || (url ? url.hostname : 'Share preview')),
      create('p', 'social-preview-title', preview.title || '(Untitled page)'),
      create('p', '', preview.description || 'No social description is declared.'),
    );
  }
  card.append(copy);
  return card;
}

function loadPreviewImages(grid, loadButton) {
  grid.querySelectorAll('.social-media[data-image-url]').forEach((media) => {
    const imageUrl = media.dataset.imageUrl;
    if (!imageUrl) return;
    const image = document.createElement('img');
    image.alt = media.dataset.imageAlt || 'Declared social preview image';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('load', () => media.classList.add('loaded'), { once: true });
    image.addEventListener('error', () => {
      media.replaceChildren(create('strong', '', 'Image could not be loaded'), create('span', '', imageUrl));
      media.classList.add('failed');
    }, { once: true });
    media.replaceChildren(image);
    image.src = imageUrl;
  });
  loadButton.disabled = true;
  loadButton.textContent = 'Images requested';
}

function safePreviewImageUrl(value) {
  const url = parseUrl(value);
  return url && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
}

function renderTracking(report) {
  const panel = resetPanel(panels.tracking);
  const block = sectionBlock('Detected tracking and consent tools', 'Evidence from rendered tags and loaded-resource names');

  if (!report.tracking.length) {
    block.append(emptyState('No known tracking tags detected', 'This does not prove a page is tracker-free. Blocked, proxied, server-side, or unfamiliar tools may not leave visible evidence.', true));
  } else {
    const list = create('div', 'tracker-list');
    report.tracking.forEach((tracker) => {
      const card = create('article', 'tracker-card');
      const header = create('div', 'tracker-header');
      const meta = create('div', 'tracker-meta');
      meta.append(create('span', 'category-pill', tracker.category), create('span', 'confidence-pill', `${tracker.confidence} confidence`));
      header.append(create('div', 'tracker-name', tracker.name), meta);
      const evidence = create('ul', 'evidence-list');
      tracker.evidence.forEach((item) => {
        const row = create('li');
        row.append(create('span', 'evidence-kind', item.kind), create('span', 'evidence-value', item.value));
        evidence.append(row);
      });
      card.append(header, evidence);
      list.append(card);
    });
    block.append(list);
  }
  panel.append(block);

  const note = create('div', 'note-card');
  note.append(create('strong', '', 'Detection boundary'), create('p', '', 'SEOMarkup reports evidence, not intent or legal compliance. It cannot see server-side tracking or resources removed by blockers before the scan.'));
  panel.append(note);
}

function sectionBlock(title, detail) {
  const block = create('section', 'section-block');
  const heading = create('div', 'section-heading');
  heading.append(create('h2', '', title), create('p', '', detail));
  block.append(heading);
  return block;
}

function createIssueList(issues) {
  const list = create('div', 'issue-list');
  issues.forEach((item) => {
    const row = create('article', `issue ${item.severity}`);
    const copy = create('div');
    copy.append(create('p', 'issue-title', item.title), create('p', 'issue-detail', item.detail));
    row.append(create('span', 'issue-marker'), copy, create('span', 'area-label', item.area));
    list.append(row);
  });
  return list;
}

function createFieldRow(label, value, status = 'good', note = '') {
  const row = create('div', 'field-row');
  const valueWrap = create('div');
  const valueElement = create('div', `field-value${value ? '' : ' missing'}`, value || 'Not declared');
  valueWrap.append(valueElement);
  if (note) valueWrap.append(create('div', 'field-note', note));
  row.append(create('div', 'field-label', label), valueWrap, statusPill(statusLabel(status), status));
  return row;
}

function statusLabel(status) {
  if (status === 'error') return 'Error';
  if (status === 'warning') return 'Review';
  return 'Found';
}

function statusPill(text, status) {
  return create('span', `status-pill ${status}`, text);
}

function emptyState(title, detail, good = false) {
  const state = create('div', `empty-state${good ? ' good' : ''}`);
  state.append(create('strong', '', title), create('p', '', detail));
  return state;
}

function resetPanel(panel) {
  panel.replaceChildren();
  panel.scrollTop = 0;
  return panel;
}

function create(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== '') element.textContent = text;
  return element;
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch {
    showToast('Clipboard access was blocked');
  }
}

function copySummary() {
  if (!currentReport) return;
  const report = currentReport;
  const lines = [
    `SEOMarkup inspection: ${report.page.title}`,
    report.page.url,
    '',
    `${report.summary.schemaItems} schema items · ${report.summary.errors} errors · ${report.summary.warnings} warnings · ${report.summary.trackers} trackers`,
  ];
  if (report.structuredData.types.length) lines.push(`Schema types: ${report.structuredData.types.join(', ')}`);
  if (report.issues.length) {
    lines.push('', 'Findings:');
    report.issues.forEach((item) => lines.push(`- [${item.severity.toUpperCase()}] ${item.title}: ${item.detail}`));
  }
  if (report.tracking.length) lines.push('', `Tracking evidence: ${report.tracking.map((item) => item.name).join(', ')}`);
  lines.push('', 'Analyzed locally. No page data was sent by SEOMarkup.');
  copyText(lines.join('\n'), 'Summary copied');
}

function exportReport() {
  if (!currentReport) return;
  const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const parsed = parseUrl(currentReport.page.url);
  const host = parsed ? parsed.hostname.replace(/[^a-z0-9.-]+/gi, '-') : 'page';
  link.href = url;
  link.download = `seomarkup-${host}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('JSON report exported');
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove('visible'), 1600);
}

function createDemoReport() {
  const seoFields = [
    { label: 'Title', value: 'Practical schema markup guide for publishers', status: 'good', note: '45 characters' },
    { label: 'Description', value: 'Learn how to add and verify structured data without exposing page information to third-party browser extensions.', status: 'good', note: '111 characters' },
    { label: 'Canonical', value: 'https://example.com/guides/schema-markup', status: 'good', note: '' },
    { label: 'Robots', value: 'index,follow', status: 'good', note: '' },
    { label: 'Language', value: 'en', status: 'good', note: '' },
    { label: 'Viewport', value: 'width=device-width, initial-scale=1', status: 'good', note: '' },
    { label: 'H1 headings', value: 'Practical schema markup guide', status: 'good', note: '1 H1 · 5 H2' },
    { label: 'Image alt', value: '7 of 8 covered', status: 'warning', note: '1 missing alt attribute' },
    { label: 'Hreflang', value: 'lt: https://example.com/lt/gidai/schema', status: 'good', note: '1 alternate URL' },
  ];
  const socialFields = [
    { label: 'og:title', value: 'Practical schema markup guide', status: 'good', note: '' },
    { label: 'og:description', value: 'Inspect structured data, SEO, and social metadata safely.', status: 'good', note: '' },
    { label: 'og:image', value: 'https://example.com/social/schema-guide.png', status: 'good', note: '' },
    { label: 'og:image:alt', value: '', status: 'warning', note: '' },
    { label: 'og:url', value: 'https://example.com/guides/schema-markup', status: 'good', note: '' },
    { label: 'og:type', value: 'article', status: 'good', note: '' },
    { label: 'twitter:card', value: 'summary_large_image', status: 'good', note: '' },
    { label: 'twitter:title', value: '', status: 'good', note: 'Open Graph fallback available' },
    { label: 'twitter:description', value: '', status: 'good', note: 'Open Graph fallback available' },
    { label: 'twitter:image', value: '', status: 'good', note: 'Open Graph fallback available' },
  ];
  const validJson = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': 'https://example.com/guides/schema-markup#page', name: 'Practical schema markup guide' },
      { '@type': 'Article', '@id': 'https://example.com/guides/schema-markup#article', headline: 'Practical schema markup guide' },
    ],
  }, null, 2);

  const issues = [
    { severity: 'error', area: 'Schema', title: 'JSON-LD block 2 has invalid JSON', detail: 'Expected property name after a trailing comma.' },
    { severity: 'warning', area: 'SEO', title: 'Images without alt attributes found', detail: '1 of 8 images has no alt attribute. Decorative images should use alt="".' },
    { severity: 'warning', area: 'Social', title: 'Open Graph image alt text is missing', detail: 'Add og:image:alt to describe the image.' },
    { severity: 'info', area: 'SEO', title: 'One alternate language is declared', detail: 'Consider an x-default URL when this page has a language selector.' },
  ];

  return {
    generatedAt: new Date().toISOString(),
    page: { url: 'https://example.com/guides/schema-markup', title: 'Practical schema markup guide for publishers' },
    summary: { schemaItems: 4, needsAttention: 3, errors: 1, warnings: 2, informational: 1, trackers: 3, networkRequestsSentByExtension: 0 },
    structuredData: {
      types: ['Article', 'BreadcrumbList', 'Organization', 'WebPage'],
      jsonLd: [
        { index: 1, valid: true, raw: validJson, formatted: validJson, truncated: false, types: ['WebPage', 'Article'], ids: ['https://example.com/guides/schema-markup#page', 'https://example.com/guides/schema-markup#article'], contexts: ['https://schema.org'], entityCount: 2, issues: [] },
        { index: 2, valid: false, raw: '{ "@context": "https://schema.org", "@type": "BreadcrumbList", }', formatted: '', truncated: false, types: [], ids: [], contexts: [], entityCount: 0, issues: ['Expected property name after a trailing comma.'] },
      ],
      microdata: [{ index: 1, types: ['Organization'], id: 'https://example.com/#organization', propertyCount: 4 }],
      rdfa: [{ index: 1, types: ['BreadcrumbList'], vocab: 'https://schema.org/', propertyCount: 5 }],
    },
    seo: { fields: seoFields, noindex: false, headings: { h1: ['Practical schema markup guide'], h2: [] }, hreflang: [] },
    social: {
      openGraph: { title: 'Practical schema markup guide', description: 'Inspect structured data, SEO, and social metadata safely.', image: 'https://example.com/social/schema-guide.png', imageAlt: '', url: 'https://example.com/guides/schema-markup', type: 'article', siteName: 'Example Publishing' },
      twitter: { card: 'summary_large_image', title: '', description: '', image: '', imageAlt: '', site: '', creator: '' },
      previews: [
        { id: 'google', label: 'Google', title: 'Practical schema markup guide for publishers', description: 'Learn how to add and verify structured data without exposing page information to third-party browser extensions.', url: 'https://example.com/guides/schema-markup', siteName: 'Example Publishing', image: '', imageAlt: '', card: 'search-result' },
        { id: 'facebook', label: 'Facebook', title: 'Practical schema markup guide', description: 'Inspect structured data, SEO, and social metadata safely.', url: 'https://example.com/guides/schema-markup', siteName: 'Example Publishing', image: 'https://example.com/social/schema-guide.png', imageAlt: '', card: 'summary-large-image' },
        { id: 'x', label: 'X / Twitter', title: 'Practical schema markup guide', description: 'Inspect structured data, SEO, and social metadata safely.', url: 'https://example.com/guides/schema-markup', siteName: 'example.com', image: 'https://example.com/social/schema-guide.png', imageAlt: '', card: 'summary_large_image' },
        { id: 'linkedin', label: 'LinkedIn', title: 'Practical schema markup guide', description: 'Inspect structured data, SEO, and social metadata safely.', url: 'https://example.com/guides/schema-markup', siteName: 'Example Publishing', image: 'https://example.com/social/schema-guide.png', imageAlt: '', card: 'summary-large-image' },
      ],
      fields: socialFields,
      issues: issues.filter((item) => item.area === 'Social'),
    },
    tracking: [
      { name: 'Google Tag Manager', category: 'Tag manager', confidence: 'High', evidence: [{ kind: 'Script', value: 'https://www.googletagmanager.com/gtm.js?id=…' }] },
      { name: 'Plausible Analytics', category: 'Analytics', confidence: 'High', evidence: [{ kind: 'Script', value: 'https://plausible.io/js/script.js' }] },
      { name: 'LinkedIn Insight Tag', category: 'Advertising', confidence: 'High', evidence: [{ kind: 'Loaded resource', value: 'https://px.ads.linkedin.com/collect?v=…' }] },
    ],
    issues,
    limitations: [],
  };
}
