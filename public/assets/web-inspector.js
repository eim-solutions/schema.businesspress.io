'use strict';

(function setupWebInspector() {
  const form = document.getElementById('urlInspectorForm');
  if (!form || !globalThis.SEOMarkupAnalyzer) return;

  const input = document.getElementById('inspectionUrl');
  const button = document.getElementById('inspectUrlButton');
  const buttonLabel = document.getElementById('inspectUrlButtonLabel');
  const status = document.getElementById('inspectionStatus');
  const workspace = document.getElementById('browserReport');
  const reportTitle = document.getElementById('reportTitle');
  const reportUrl = document.getElementById('reportUrl');
  const reportMeta = document.getElementById('reportMeta');
  const reportStats = document.getElementById('reportStats');
  const reportTabs = document.getElementById('reportTabs');
  const reportPanel = document.getElementById('reportPanel');
  const loadImagesOption = document.getElementById('loadPreviewImagesOption');
  const shareButton = document.getElementById('shareWebReport');
  const copyButton = document.getElementById('copyWebReport');
  const exportButton = document.getElementById('exportWebReport');
  const shareCodec = globalThis.SEOMarkupReportShare;
  let currentReport = null;
  let activePanel = 'overview';
  let currentShareUrl = '';

  form.addEventListener('submit', inspectUrl);
  if (shareButton) shareButton.addEventListener('click', copyShareLink);
  copyButton.addEventListener('click', copySummary);
  exportButton.addEventListener('click', exportReport);
  reportTabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-report-tab]');
    if (!tab || !currentReport) return;
    activePanel = tab.dataset.reportTab;
    renderActivePanel();
  });
  reportTabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...reportTabs.querySelectorAll('[data-report-tab]')];
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    let next = current;
    if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    tabs[next].focus();
    tabs[next].click();
  });
  void restoreSharedReport();

  async function inspectUrl(event) {
    event.preventDefault();
    const submittedUrl = input.value.trim();
    if (!submittedUrl) {
      showStatus('Enter a public URL.', 'error');
      input.focus();
      return;
    }

    button.disabled = true;
    buttonLabel.textContent = 'Checking page…';
    workspace.hidden = true;
    clearShareHash();
    showStatus('Fetching the page. We do not save it or the report.', 'loading');

    try {
      const response = await fetch('/api/inspect.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        body: JSON.stringify({ url: submittedUrl }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && payload.error ? payload.error : `The check failed with HTTP ${response.status}. Try again.`);
      }

      const parsed = new DOMParser().parseFromString(payload.page.html, 'text/html');
      const snapshot = globalThis.SEOMarkupAnalyzer.collectSnapshot(parsed, null);
      snapshot.url = payload.page.url;
      currentReport = globalThis.SEOMarkupAnalyzer.analyzeSnapshot(snapshot);
      currentReport.scan = {
        mode: 'Source HTML',
        requestedUrl: payload.page.url,
        status: payload.page.status,
        bytes: payload.page.bytes,
        fetchedAt: currentReport.generatedAt,
        retention: 'Not saved by SEOMarkup',
      };
      currentReport.limitations = [
        'This report checks source HTML, not the rendered page.',
        'Use the Chrome extension to find markup added by JavaScript and evidence from loaded resources.',
        'Declared preview images load directly from their source only when you select that option or request them in the Social tab.',
        'These checks do not confirm search-engine feature eligibility.',
      ];

      renderReport();
      workspace.hidden = false;
      const shareCreated = await createShareUrl();
      showStatus(shareCreated
        ? 'Check complete. Your report and share link are ready below.'
        : 'Check complete. Your report is ready below. Download JSON if you need to share it.', 'success');
      workspace.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (error) {
      currentReport = null;
      showStatus(error && error.message ? error.message : 'We could not check this page. Try another public URL.', 'error');
    } finally {
      button.disabled = false;
      buttonLabel.textContent = 'Check URL';
    }
  }

  function renderReport() {
    const report = currentReport;
    const url = safePublicUrl(report.page.url);
    const shared = report.scan && report.scan.mode === 'Shared source report';
    reportTitle.textContent = report.page.title;
    reportUrl.textContent = report.page.url;
    reportUrl.href = url ? url.href : '#';
    reportMeta.textContent = shared
      ? `Shared report · source HTTP ${report.scan.status} · ${formatBytes(report.scan.bytes)} · no new fetch`
      : `Source HTML · HTTP ${report.scan.status} · ${formatBytes(report.scan.bytes)} · Not saved`;

    const stats = [
      [report.summary.schemaItems, 'Schema items'],
      [report.summary.needsAttention, 'Issues'],
      [report.summary.trackers, 'Trackers'],
      [shared ? 0 : 1, shared ? 'Pages fetched now' : 'Page fetched'],
    ];
    reportStats.replaceChildren(...stats.map(([value, label], index) => {
      const item = element('div', index === 3 ? 'browser-stat browser-stat-network' : 'browser-stat');
      item.append(element('strong', '', String(value)), element('span', '', label));
      return item;
    }));

    reportTabs.querySelectorAll('[data-report-tab]').forEach((tab) => {
      const selected = tab.dataset.reportTab === activePanel;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (tab.dataset.reportTab === 'schema') tab.querySelector('span').textContent = report.summary.schemaItems;
      if (tab.dataset.reportTab === 'tracking') tab.querySelector('span').textContent = report.summary.trackers;
    });
    renderActivePanel();
    workspace.dataset.host = url ? url.hostname : '';
  }

  function renderActivePanel() {
    reportTabs.querySelectorAll('[data-report-tab]').forEach((tab) => {
      const selected = tab.dataset.reportTab === activePanel;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    reportPanel.replaceChildren();
    if (activePanel === 'schema') renderSchema();
    else if (activePanel === 'seo') renderFields('Search metadata', 'Found in the source HTML.', currentReport.seo.fields);
    else if (activePanel === 'social') renderSocial();
    else if (activePanel === 'tracking') renderTracking();
    else renderOverview();
  }

  function renderOverview() {
    const priority = currentReport.issues.filter((issue) => issue.severity !== 'info');
    const section = reportSection('Issues to review', `${countLabel(currentReport.summary.errors, 'error')} · ${countLabel(currentReport.summary.warnings, 'warning')}`);
    if (!priority.length) {
      section.append(emptyState('No source markup issues found', 'This does not confirm rendered markup or rich-result eligibility. Use the extension and relevant search tools for those checks.', true));
    } else {
      const list = element('div', 'web-issue-list');
      priority.forEach((issue) => {
        const card = element('article', `web-issue ${issue.severity}`);
        const copy = element('div');
        copy.append(element('strong', '', issue.title), element('p', '', issue.detail));
        card.append(element('span', 'web-issue-mark'), copy, element('small', '', issue.area));
        list.append(card);
      });
      section.append(list);
    }
    reportPanel.append(section);

    const types = reportSection('Schema types', `${countLabel(currentReport.structuredData.types.length, 'type')} found`);
    if (currentReport.structuredData.types.length) {
      const chips = element('div', 'web-type-list');
      currentReport.structuredData.types.forEach((type) => chips.append(element('span', '', type)));
      types.append(chips);
    } else {
      types.append(emptyState('No Schema.org types in the source HTML', 'The source has no JSON-LD, Microdata or RDFa type declarations.'));
    }
    reportPanel.append(types, sourceBoundary());
  }

  function renderSchema() {
    const section = reportSection('JSON-LD', countLabel(currentReport.structuredData.jsonLd.length, 'block'));
    if (!currentReport.structuredData.jsonLd.length) {
      section.append(emptyState('No JSON-LD in the source HTML', 'Use the Chrome extension to check for markup added by JavaScript.'));
    } else {
      currentReport.structuredData.jsonLd.forEach((block) => {
        const details = element('details', 'web-schema-card');
        const summary = element('summary');
        const title = element('div');
        title.append(
          element('strong', '', block.types.length ? block.types.join(', ') : `JSON-LD block ${block.index}`),
          element('span', '', `${block.entityCount || 0} ${block.entityCount === 1 ? 'entity' : 'entities'}`),
        );
        summary.append(title, statusPill(block.valid && !block.issues.length ? 'Valid JSON' : block.valid ? 'Review' : 'Invalid', block.valid && !block.issues.length ? 'good' : block.valid ? 'warning' : 'error'));
        const body = element('div', 'web-schema-body');
        if (block.issues.length) {
          const list = element('ul');
          block.issues.forEach((message) => list.append(element('li', '', message)));
          body.append(list);
        }
        const pre = element('pre', '', block.formatted || block.raw || '(empty)');
        body.append(pre);
        details.append(summary, body);
        section.append(details);
      });
    }
    reportPanel.append(section, sourceBoundary());
  }

  function renderFields(title, description, fields) {
    const section = reportSection(title, description);
    const list = element('div', 'web-field-list');
    fields.forEach((field) => {
      const row = element('div', 'web-field-row');
      const value = element('div');
      value.append(element('strong', '', field.value || 'Not declared'));
      if (field.note) value.append(element('small', '', field.note));
      row.append(element('span', '', field.label), value, statusPill(field.status === 'warning' ? 'Review' : field.status === 'error' ? 'Error' : 'Found', field.status));
      list.append(row);
    });
    section.append(list);
    reportPanel.append(section, sourceBoundary());
  }

  function renderSocial() {
    const previews = currentReport.social.previews || [];
    const section = reportSection('Share previews', 'Approximate previews from declared metadata. Platforms may crop or rewrite them.');
    const grid = element('div', 'web-social-preview-grid');
    previews.forEach((preview) => grid.append(socialPreviewCard(preview)));

    const hasImages = previews.some((preview) => safePreviewImageUrl(preview.image));
    const autoLoadImages = Boolean(loadImagesOption && loadImagesOption.checked);
    if (hasImages) {
      const controls = element('div', 'web-social-load-control');
      const copy = element('p', '', autoLoadImages
        ? 'Declared images are requested directly from their source with no referrer.'
        : 'Images are blocked. Load them directly from their source with no referrer.');
      controls.append(copy);
      if (!autoLoadImages) {
        const loadButton = element('button', 'button button-secondary', 'Load preview images');
        loadButton.type = 'button';
        loadButton.addEventListener('click', () => loadPreviewImages(grid, loadButton));
        controls.append(loadButton);
      }
      section.append(controls);
    }
    section.append(grid);
    if (hasImages && autoLoadImages) loadPreviewImages(grid);
    reportPanel.append(section);

    const tags = reportSection('Declared social tags', 'Open Graph and X/Twitter tags found in the source HTML.');
    const list = element('div', 'web-field-list');
    currentReport.social.fields.forEach((field) => {
      const row = element('div', 'web-field-row');
      const value = element('div');
      value.append(element('strong', '', field.value || 'Not declared'));
      if (field.note) value.append(element('small', '', field.note));
      row.append(element('span', '', field.label), value, statusPill(field.status === 'warning' ? 'Review' : field.status === 'error' ? 'Error' : 'Found', field.status));
      list.append(row);
    });
    tags.append(list);
    reportPanel.append(tags, sourceBoundary());
  }

  function socialPreviewCard(preview) {
    const compactX = preview.id === 'x' && preview.card === 'summary';
    const card = element('article', `web-social-preview web-social-${preview.id}${compactX ? ' web-social-compact' : ''}`);
    card.setAttribute('aria-label', `${preview.label} preview`);
    card.append(element('h4', 'web-social-platform', preview.label));

    if (preview.id !== 'google') {
      const media = element('div', 'web-preview-media');
      const imageUrl = safePreviewImageUrl(preview.image);
      media.dataset.imageUrl = imageUrl;
      media.dataset.imageAlt = preview.imageAlt || `${preview.label} share image`;
      media.append(
        element('strong', '', imageUrl ? 'Image declared — not loaded' : 'No image declared'),
        element('span', '', imageUrl || 'Add an image tag to control this preview.'),
      );
      card.append(media);
    }

    const copy = element('div', 'web-preview-copy');
    const host = previewHostname(preview.url);
    if (preview.id === 'google') {
      copy.append(
        element('span', 'web-google-site', preview.siteName || host || 'Website'),
        element('span', 'web-google-url', preview.url || currentReport.page.url),
        element('p', 'web-preview-title', preview.title || '(Untitled page)'),
        element('p', '', preview.description || 'No meta description is declared.'),
      );
    } else {
      copy.append(
        element('small', '', preview.siteName || host || 'Share preview'),
        element('p', 'web-preview-title', preview.title || '(Untitled page)'),
        element('p', '', preview.description || 'No social description is declared.'),
      );
    }
    card.append(copy);
    return card;
  }

  function loadPreviewImages(grid, loadButton = null) {
    const mediaItems = [...grid.querySelectorAll('.web-preview-media[data-image-url]')].filter((media) => media.dataset.imageUrl);
    let remaining = mediaItems.length;
    let failed = 0;
    if (loadButton) {
      loadButton.disabled = true;
      loadButton.textContent = 'Loading images…';
    }

    const finish = (didFail) => {
      if (didFail) failed += 1;
      remaining -= 1;
      if (loadButton && remaining === 0) loadButton.textContent = failed ? 'Some images failed' : 'Images loaded';
    };

    mediaItems.forEach((media) => {
      const imageUrl = media.dataset.imageUrl;
      const image = document.createElement('img');
      image.alt = media.dataset.imageAlt || 'Declared social preview image';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('load', () => {
        media.classList.add('loaded');
        finish(false);
      }, { once: true });
      image.addEventListener('error', () => {
        media.replaceChildren(element('strong', '', 'Image could not be loaded'), element('span', '', imageUrl));
        media.classList.add('failed');
        finish(true);
      }, { once: true });
      media.replaceChildren(image);
      image.src = imageUrl;
    });
    if (loadButton && mediaItems.length === 0) loadButton.textContent = 'No images declared';
  }

  function safePreviewImageUrl(value) {
    const url = safeUrl(value);
    return url && ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  }

  function previewHostname(value) {
    const url = safeUrl(value);
    return url ? url.hostname : '';
  }

  function renderTracking() {
    const section = reportSection('Detected trackers', 'Matched in source tags, images, iframes or inline code.');
    if (!currentReport.tracking.length) {
      section.append(emptyState('No known trackers in the source HTML', 'This does not rule out runtime, server-side, blocked, proxied or unfamiliar trackers.', true));
    } else {
      const list = element('div', 'web-tracker-list');
      currentReport.tracking.forEach((tracker) => {
        const card = element('article', 'web-tracker-card');
        const heading = element('div', 'web-tracker-heading');
        heading.append(element('strong', '', tracker.name), element('span', '', `${tracker.category} · ${tracker.confidence} confidence`));
        const evidence = element('ul');
        tracker.evidence.forEach((item) => {
          const row = element('li');
          row.append(element('small', '', item.kind), element('code', '', item.value));
          evidence.append(row);
        });
        card.append(heading, evidence);
        list.append(card);
      });
      section.append(list);
    }
    reportPanel.append(section, sourceBoundary());
  }

  function sourceBoundary() {
    const note = element('aside', 'source-boundary');
    note.append(element('strong', '', 'Source-only check'), element('p', '', 'This website checks one HTML response. Use the extension to inspect rendered markup and loaded resources.'));
    return note;
  }

  function reportSection(title, detail) {
    const section = element('section', 'web-report-section');
    const heading = element('div', 'web-section-heading');
    heading.append(element('h3', '', title), element('p', '', detail));
    section.append(heading);
    return section;
  }

  function emptyState(title, detail, good = false) {
    const item = element('div', `web-empty${good ? ' good' : ''}`);
    item.append(element('strong', '', title), element('p', '', detail));
    return item;
  }

  function statusPill(label, statusName) {
    return element('span', `web-status ${statusName}`, label);
  }

  function showStatus(message, kind) {
    status.textContent = message;
    status.className = `inspection-status ${kind}`;
  }

  async function copySummary() {
    if (!currentReport) return;
    const lines = [
      'SEOMarkup source check',
      currentReport.page.title,
      currentReport.page.url,
      `Schema items: ${currentReport.summary.schemaItems}`,
      `Issues: ${currentReport.summary.needsAttention}`,
      `Trackers: ${currentReport.summary.trackers}`,
      '',
      ...currentReport.issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.area}: ${issue.title} — ${issue.detail}`),
      '',
      'Source HTML only. SEOMarkup did not save this report.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      copyButton.textContent = 'Summary copied';
      setTimeout(() => { copyButton.textContent = 'Copy summary'; }, 1600);
    } catch {
      showStatus('Your browser blocked clipboard access. Download the JSON report instead.', 'error');
    }
  }

  async function createShareUrl() {
    if (!currentReport || !shareCodec || !shareButton) return '';
    try {
      const token = await shareCodec.encodeReport(currentReport);
      const url = new URL(location.href);
      url.hash = `report=${token}`;
      history.replaceState(null, '', url);
      currentShareUrl = url.href;
      shareButton.disabled = false;
      return currentShareUrl;
    } catch (error) {
      currentShareUrl = '';
      shareButton.disabled = true;
      shareButton.textContent = 'Share unavailable';
      return '';
    }
  }

  async function copyShareLink() {
    if (!currentReport || !shareButton) return;
    const shareUrl = currentShareUrl || await createShareUrl();
    if (!shareUrl) {
      showStatus('This report is too large to share as a link. Download the JSON report instead.', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      shareButton.textContent = 'Share link copied';
      showStatus('Share link copied. Anyone with the link can read this report.', 'success');
      setTimeout(() => { shareButton.textContent = 'Copy share link'; }, 1800);
    } catch {
      showStatus('Your browser blocked clipboard access. Copy the current address from the address bar.', 'error');
    }
  }

  async function restoreSharedReport() {
    const prefix = '#report=';
    if (!location.hash.startsWith(prefix)) return;
    if (!shareCodec) {
      showStatus('This browser cannot open shared reports. Check the URL again to create a new report.', 'error');
      return;
    }
    try {
      currentReport = await shareCodec.decodeReport(location.hash.slice(prefix.length));
      currentShareUrl = location.href;
      activePanel = 'overview';
      input.value = currentReport.page.url;
      renderReport();
      workspace.hidden = false;
      if (shareButton) shareButton.disabled = false;
      showStatus('Shared report loaded from this link. No page was fetched.', 'success');
      workspace.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch {
      currentReport = null;
      workspace.hidden = true;
      showStatus('This share link is invalid or incomplete. Check a public URL to create a new report.', 'error');
    }
  }

  function clearShareHash() {
    currentShareUrl = '';
    if (shareButton) {
      shareButton.disabled = true;
      shareButton.textContent = 'Copy share link';
    }
    if (!location.hash.startsWith('#report=')) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  function exportReport() {
    if (!currentReport) return;
    const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const pageUrl = safeUrl(currentReport.page.url);
    link.href = href;
    link.download = `seomarkup-${pageUrl ? pageUrl.hostname.replace(/[^a-z0-9.-]/gi, '-') : 'report'}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  function safeUrl(value) {
    try { return new URL(value); } catch { return null; }
  }

  function safePublicUrl(value) {
    const url = safeUrl(value);
    return url && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url : null;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(bytes > 10240 ? 0 : 1)} KB`;
  }

  function countLabel(count, noun) {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
  }

  function reducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function element(tag, className = '', text = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== '') node.textContent = text;
    return node;
  }
}());
