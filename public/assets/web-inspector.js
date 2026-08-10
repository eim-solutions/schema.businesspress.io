'use strict';

(function setupWebInspector() {
  const form = document.getElementById('urlInspectorForm');
  if (!form || !globalThis.SEOMarkupAnalyzer) return;

  const input = document.getElementById('inspectionUrl');
  const button = document.getElementById('inspectUrlButton');
  const status = document.getElementById('inspectionStatus');
  const workspace = document.getElementById('browserReport');
  const reportTitle = document.getElementById('reportTitle');
  const reportUrl = document.getElementById('reportUrl');
  const reportMeta = document.getElementById('reportMeta');
  const reportStats = document.getElementById('reportStats');
  const reportTabs = document.getElementById('reportTabs');
  const reportPanel = document.getElementById('reportPanel');
  const copyButton = document.getElementById('copyWebReport');
  const exportButton = document.getElementById('exportWebReport');
  let currentReport = null;
  let activePanel = 'overview';

  form.addEventListener('submit', inspectUrl);
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

  async function inspectUrl(event) {
    event.preventDefault();
    const submittedUrl = input.value.trim();
    if (!submittedUrl) {
      showStatus('Enter a public website URL.', 'error');
      input.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Inspecting source…';
    workspace.hidden = true;
    showStatus('Fetching one public HTML page. Nothing is saved to scan history.', 'loading');

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
        throw new Error(payload && payload.error ? payload.error : `The scan returned HTTP ${response.status}.`);
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
        retention: 'Not stored by SEOMarkup',
      };
      currentReport.limitations = [
        'This web report inspects fetched source HTML, not the browser-rendered DOM.',
        'JavaScript-injected markup and loaded-resource evidence require the local Chrome extension.',
        'Structural checks are not search-engine feature-eligibility validation.',
      ];

      renderReport();
      showStatus('Source inspection complete. The report exists in this browser tab.', 'success');
      workspace.hidden = false;
      workspace.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (error) {
      currentReport = null;
      showStatus(error && error.message ? error.message : 'The page could not be inspected.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Inspect this URL';
    }
  }

  function renderReport() {
    const report = currentReport;
    const url = safeUrl(report.page.url);
    reportTitle.textContent = report.page.title;
    reportUrl.textContent = report.page.url;
    reportUrl.href = report.page.url;
    reportMeta.textContent = `Source HTML · HTTP ${report.scan.status} · ${formatBytes(report.scan.bytes)} · not saved`;

    const stats = [
      [report.summary.schemaItems, 'Schema items'],
      [report.summary.needsAttention, 'Needs attention'],
      [report.summary.trackers, 'Tracker signatures'],
      [1, 'Page fetched'],
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
    else if (activePanel === 'seo') renderFields('Search metadata', 'Values declared in the fetched source HTML.', currentReport.seo.fields);
    else if (activePanel === 'social') renderFields('Social cards', 'Open Graph and X/Twitter declarations with fallback guidance.', currentReport.social.fields);
    else if (activePanel === 'tracking') renderTracking();
    else renderOverview();
  }

  function renderOverview() {
    const priority = currentReport.issues.filter((issue) => issue.severity !== 'info');
    const section = reportSection('Priority findings', `${currentReport.summary.errors} errors · ${currentReport.summary.warnings} warnings`);
    if (!priority.length) {
      section.append(emptyState('No structural warnings found', 'Source markup passed SEOMarkup’s checks. Rendered behavior and rich-result eligibility still need their relevant tools.', true));
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

    const types = reportSection('Schema vocabulary', `${currentReport.structuredData.types.length} distinct types`);
    if (currentReport.structuredData.types.length) {
      const chips = element('div', 'web-type-list');
      currentReport.structuredData.types.forEach((type) => chips.append(element('span', '', type)));
      types.append(chips);
    } else {
      types.append(emptyState('No Schema.org types found', 'The fetched source contains no JSON-LD, Microdata, or RDFa type declarations.'));
    }
    reportPanel.append(types, sourceBoundary());
  }

  function renderSchema() {
    const section = reportSection('JSON-LD', `${currentReport.structuredData.jsonLd.length} blocks`);
    if (!currentReport.structuredData.jsonLd.length) {
      section.append(emptyState('No JSON-LD found', 'JavaScript-injected JSON-LD may appear only in a rendered extension scan.'));
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

  function renderTracking() {
    const section = reportSection('Tracker signatures', 'Evidence present in source tags, images, iframes, and inline code.');
    if (!currentReport.tracking.length) {
      section.append(emptyState('No known tracker signatures found', 'This does not prove the page is tracker-free. Runtime, proxied, server-side, blocked, or unfamiliar tools may not appear in source HTML.', true));
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
    note.append(element('strong', '', 'Source scan boundary'), element('p', '', 'The website fetches one public HTML response. Use the local extension for rendered DOM, client-side injected markup, and loaded-resource evidence.'));
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
      'SEOMarkup source report',
      currentReport.page.title,
      currentReport.page.url,
      `Schema items: ${currentReport.summary.schemaItems}`,
      `Needs attention: ${currentReport.summary.needsAttention}`,
      `Tracker signatures: ${currentReport.summary.trackers}`,
      '',
      ...currentReport.issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.area}: ${issue.title} — ${issue.detail}`),
      '',
      'Source HTML only; no scan history stored by SEOMarkup.',
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      copyButton.textContent = 'Summary copied';
      setTimeout(() => { copyButton.textContent = 'Copy summary'; }, 1600);
    } catch {
      showStatus('Clipboard access was blocked. Export the JSON report instead.', 'error');
    }
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

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(bytes > 10240 ? 0 : 1)} KB`;
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
