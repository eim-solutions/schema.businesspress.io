(function attachSEOMarkup(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.SEOMarkupAnalyzer = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createSEOMarkupAnalyzer() {
  'use strict';

  const MAX_INLINE_SOURCE = 30000;
  const MAX_JSON_LD_SOURCE = 120000;
  const MAX_EVIDENCE_PER_TRACKER = 4;

  const TRACKER_RULES = [
    {
      name: 'Google Tag Manager',
      category: 'Tag manager',
      urls: ['googletagmanager.com/gtm.js'],
      inline: [/\bGTM-[A-Z0-9]+\b/i, /googletagmanager\.com\/gtm\.js/i],
    },
    {
      name: 'Google Analytics',
      category: 'Analytics',
      urls: ['googletagmanager.com/gtag/js', 'google-analytics.com/analytics.js', 'google-analytics.com/g/collect'],
      inline: [/\bgtag\s*\(/i, /GoogleAnalyticsObject/i, /\bG-[A-Z0-9]{5,}\b/i, /\bUA-\d+-\d+\b/i],
    },
    {
      name: 'Google Ads / Floodlight',
      category: 'Advertising',
      urls: ['googleadservices.com', 'doubleclick.net', 'googlesyndication.com/pagead'],
      inline: [/\bAW-\d+\b/i, /\bDC-\d+\b/i],
    },
    {
      name: 'Meta Pixel',
      category: 'Advertising',
      urls: ['connect.facebook.net/en_US/fbevents.js', 'facebook.com/tr'],
      inline: [/\bfbq\s*\(/i, /_fbq\b/i],
    },
    {
      name: 'LinkedIn Insight Tag',
      category: 'Advertising',
      urls: ['snap.licdn.com/li.lms-analytics/insight.min.js', 'px.ads.linkedin.com/collect'],
      inline: [/_linkedin_partner_id/i],
    },
    {
      name: 'TikTok Pixel',
      category: 'Advertising',
      urls: ['analytics.tiktok.com/i18n/pixel/events.js', 'analytics.tiktok.com/i18n/pixel/static'],
      inline: [/\bttq\.(load|page|track)\b/i],
    },
    {
      name: 'Microsoft Clarity',
      category: 'Session analytics',
      urls: ['clarity.ms/tag/', 'clarity.ms/collect'],
      inline: [/\bclarity\s*\(/i],
    },
    {
      name: 'Hotjar',
      category: 'Session analytics',
      urls: ['static.hotjar.com/c/hotjar-', 'script.hotjar.com'],
      inline: [/\bhj\s*\(/i, /_hjSettings/i],
    },
    {
      name: 'Plausible Analytics',
      category: 'Analytics',
      urls: ['plausible.io/js/', 'plausible.io/api/event', 'stats.businesspress.io/js/script.js'],
      inline: [/\bplausible\s*\(/i, /\bwindow\.plausible\b/i],
    },
    {
      name: 'Matomo',
      category: 'Analytics',
      urls: ['/matomo.js', '/piwik.js', '/matomo.php', '/piwik.php'],
      inline: [/\b_paq\b/i],
    },
    {
      name: 'HubSpot',
      category: 'Marketing automation',
      urls: ['js.hs-scripts.com', 'js.hs-analytics.net', 'track.hubspot.com'],
      inline: [/_hsq\b/i],
    },
    {
      name: 'Adobe Analytics',
      category: 'Analytics',
      urls: ['assets.adobedtm.com', 'omtrdc.net', '2o7.net'],
      inline: [/AppMeasurement/i, /adobeDataLayer/i],
    },
    {
      name: 'Pinterest Tag',
      category: 'Advertising',
      urls: ['s.pinimg.com/ct/core.js', 'ct.pinterest.com/v3'],
      inline: [/\bpintrk\s*\(/i],
    },
    {
      name: 'Snap Pixel',
      category: 'Advertising',
      urls: ['sc-static.net/scevent.min.js', 'tr.snapchat.com'],
      inline: [/\bsnaptr\s*\(/i],
    },
    {
      name: 'Reddit Pixel',
      category: 'Advertising',
      urls: ['events.redditmedia.com', 'alb.reddit.com'],
      inline: [/\brdt\s*\(/i],
    },
    {
      name: 'X Ads Pixel',
      category: 'Advertising',
      urls: ['static.ads-twitter.com/uwt.js', 'analytics.twitter.com/i/adsct'],
      inline: [/\btwq\s*\(/i],
    },
    {
      name: 'Segment',
      category: 'Customer data',
      urls: ['cdn.segment.com/analytics.js', 'api.segment.io/v1/'],
      inline: [/analytics\.load\s*\(/i],
    },
    {
      name: 'Mixpanel',
      category: 'Product analytics',
      urls: ['cdn.mxpnl.com', 'api-js.mixpanel.com'],
      inline: [/mixpanel\.init\s*\(/i],
    },
    {
      name: 'Heap',
      category: 'Product analytics',
      urls: ['cdn.heapanalytics.com', 'heapanalytics.com/api/'],
      inline: [/heap\.load\s*\(/i],
    },
    {
      name: 'FullStory',
      category: 'Session analytics',
      urls: ['edge.fullstory.com', 'fullstory.com/s/fs.js'],
      inline: [/_fs_org/i, /FS\.identify\s*\(/i],
    },
    {
      name: 'Crazy Egg',
      category: 'Session analytics',
      urls: ['script.crazyegg.com/pages/scripts/'],
      inline: [],
    },
    {
      name: 'Intercom',
      category: 'Customer messaging',
      urls: ['widget.intercom.io/widget/', 'js.intercomcdn.com'],
      inline: [/intercomSettings/i],
    },
    {
      name: 'Sentry',
      category: 'Error monitoring',
      urls: ['browser.sentry-cdn.com', 'ingest.sentry.io'],
      inline: [/Sentry\.init\s*\(/i],
    },
    {
      name: 'OneTrust',
      category: 'Consent management',
      urls: ['cdn.cookielaw.org', 'optanon.blob.core.windows.net'],
      inline: [/OptanonWrapper/i],
    },
    {
      name: 'Cookiebot',
      category: 'Consent management',
      urls: ['consent.cookiebot.com/uc.js', 'consentcdn.cookiebot.com'],
      inline: [/Cookiebot/i],
    },
  ];

  function cleanText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function truncate(value, maxLength) {
    const text = String(value == null ? '' : value);
    return text.length > maxLength ? `${text.slice(0, maxLength)}\n… [truncated locally]` : text;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function asArray(value) {
    return Array.isArray(value) ? value : value == null ? [] : [value];
  }

  function issue(severity, area, title, detail) {
    return { severity, area, title, detail };
  }

  function safePageUrl(value) {
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return cleanText(value);
    }
  }

  function evidenceUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      const parameterNames = unique([...url.searchParams.keys()]);
      const redactedQuery = parameterNames.length
        ? `?${parameterNames.map((name) => `${encodeURIComponent(name)}=…`).join('&')}`
        : '';
      return `${url.origin}${url.pathname}${redactedQuery}`;
    } catch {
      return truncate(cleanText(value), 180);
    }
  }

  function resolveUrl(value, baseUrl) {
    if (!value) return '';
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return cleanText(value);
    }
  }

  function getMeta(snapshot, key) {
    const normalizedKey = key.toLowerCase();
    return snapshot.metas
      .filter((meta) => [meta.name, meta.property, meta.httpEquiv].some((name) => String(name || '').toLowerCase() === normalizedKey))
      .map((meta) => cleanText(meta.content))
      .filter(Boolean);
  }

  function getLinks(snapshot, rel) {
    const normalizedRel = rel.toLowerCase();
    return snapshot.links.filter((link) => String(link.rel || '').toLowerCase().split(/\s+/).includes(normalizedRel));
  }

  function schemaContexts(value) {
    return asArray(value).map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object' && typeof item['@vocab'] === 'string') return item['@vocab'];
      return '';
    }).filter(Boolean);
  }

  function walkJsonLd(value, visitor, path = '$', seen = new Set()) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    visitor(value, path);
    if (Array.isArray(value)) {
      value.forEach((item, index) => walkJsonLd(item, visitor, `${path}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, child]) => walkJsonLd(child, visitor, `${path}.${key}`, seen));
  }

  function analyzeJsonLd(scripts) {
    const items = [];
    const issues = [];
    const allIds = new Map();

    scripts.forEach((script, index) => {
      const raw = String(script.text || '').trim();
      const item = {
        index: index + 1,
        valid: false,
        raw: truncate(raw, MAX_JSON_LD_SOURCE),
        truncated: raw.length > MAX_JSON_LD_SOURCE,
        types: [],
        ids: [],
        contexts: [],
        entityCount: 0,
        issues: [],
      };

      if (!raw) {
        item.issues.push('The JSON-LD block is empty.');
        issues.push(issue('error', 'Schema', `JSON-LD block ${index + 1} is empty`, 'Remove the empty block or add valid JSON-LD.'));
        items.push(item);
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(raw);
        item.valid = true;
      } catch (error) {
        item.issues.push(error.message);
        issues.push(issue('error', 'Schema', `JSON-LD block ${index + 1} has invalid JSON`, error.message));
        items.push(item);
        return;
      }

      const typedNodes = [];
      const graphSize = parsed && !Array.isArray(parsed) && Array.isArray(parsed['@graph']) ? parsed['@graph'].length : 0;
      item.entityCount = Array.isArray(parsed) ? parsed.length : graphSize || 1;

      walkJsonLd(parsed, (node, path) => {
        if (Object.prototype.hasOwnProperty.call(node, '@context')) {
          item.contexts.push(...schemaContexts(node['@context']));
        }
        if (Object.prototype.hasOwnProperty.call(node, '@type')) {
          const types = asArray(node['@type']).filter((type) => typeof type === 'string' && type.trim());
          item.types.push(...types);
          typedNodes.push({ path, types });
        }
        if (typeof node['@id'] === 'string' && node['@id'].trim()) {
          const id = node['@id'].trim();
          item.ids.push(id);
          const occurrences = allIds.get(id) || [];
          occurrences.push({ block: index + 1, path });
          allIds.set(id, occurrences);
        }
      });

      item.types = unique(item.types);
      item.ids = unique(item.ids);
      item.contexts = unique(item.contexts);

      const hasSchemaContext = item.contexts.some((context) => /(^|\.)schema\.org\/?$/i.test(context.replace(/^https?:\/\//i, '')));
      if (!item.contexts.length) {
        item.issues.push('No @context was found.');
        issues.push(issue('warning', 'Schema', `JSON-LD block ${index + 1} has no @context`, 'Schema.org JSON-LD normally declares https://schema.org.'));
      } else if (!hasSchemaContext) {
        item.issues.push('The declared @context does not appear to use Schema.org.');
        issues.push(issue('warning', 'Schema', `JSON-LD block ${index + 1} uses another context`, item.contexts.join(', ')));
      }

      const rootIsGraphContainer = !Array.isArray(parsed) && parsed && typeof parsed === 'object' && Array.isArray(parsed['@graph']);
      if (!item.types.length && !rootIsGraphContainer) {
        item.issues.push('No @type was found.');
        issues.push(issue('warning', 'Schema', `JSON-LD block ${index + 1} has no @type`, 'Add a Schema.org type to describe the entity.'));
      }

      typedNodes.forEach(({ path, types }) => {
        types.forEach((type) => {
          if (/\s/.test(type)) {
            item.issues.push(`${path} has an @type containing whitespace.`);
          }
        });
      });

      try {
        item.formatted = truncate(JSON.stringify(parsed, null, 2), MAX_JSON_LD_SOURCE);
      } catch {
        item.formatted = item.raw;
      }
      items.push(item);
    });

    allIds.forEach((occurrences, id) => {
      if (occurrences.length > 1) {
        issues.push(issue('warning', 'Schema', 'Duplicate @id found', `${id} appears ${occurrences.length} times. Confirm the nodes intentionally describe the same entity.`));
      }
    });

    return { items, issues };
  }

  function field(label, value, status = 'good', note = '') {
    return { label, value: value || '', status, note };
  }

  function analyzeSeo(snapshot) {
    const issues = [];
    const titleValues = snapshot.titleElements.map(cleanText).filter(Boolean);
    const title = titleValues[0] || cleanText(snapshot.documentTitle);
    const descriptions = getMeta(snapshot, 'description');
    const canonicalLinks = getLinks(snapshot, 'canonical');
    const robots = getMeta(snapshot, 'robots');
    const viewports = getMeta(snapshot, 'viewport');
    const hreflangLinks = getLinks(snapshot, 'alternate').filter((link) => link.hreflang);
    const language = cleanText(snapshot.htmlLang);
    const h1s = snapshot.headings.h1 || [];
    const h2s = snapshot.headings.h2 || [];
    const canonical = canonicalLinks[0] ? resolveUrl(canonicalLinks[0].href, snapshot.url) : '';

    if (!title) {
      issues.push(issue('error', 'SEO', 'Page title is missing', 'Add one descriptive <title> element.'));
    } else if (titleValues.length > 1) {
      issues.push(issue('warning', 'SEO', 'Multiple title elements found', `${titleValues.length} title elements can create an ambiguous search snippet.`));
    } else if (title.length < 30 || title.length > 60) {
      issues.push(issue('info', 'SEO', 'Title length is outside the common preview range', `${title.length} characters. Search engines may rewrite titles at any length.`));
    }

    if (!descriptions.length) {
      issues.push(issue('warning', 'SEO', 'Meta description is missing', 'Add a concise page summary for search and sharing contexts.'));
    } else if (descriptions.length > 1) {
      issues.push(issue('warning', 'SEO', 'Multiple meta descriptions found', `${descriptions.length} description tags can create ambiguity.`));
    } else if (descriptions[0].length < 70 || descriptions[0].length > 160) {
      issues.push(issue('info', 'SEO', 'Description length is outside the common preview range', `${descriptions[0].length} characters. This is guidance, not a ranking rule.`));
    }

    if (!canonicalLinks.length) {
      issues.push(issue('warning', 'SEO', 'Canonical URL is missing', 'Declare the preferred URL when duplicate or parameterized URLs are possible.'));
    } else if (canonicalLinks.length > 1) {
      issues.push(issue('error', 'SEO', 'Multiple canonical URLs found', `${canonicalLinks.length} canonical links were declared.`));
    }

    if (!language) {
      issues.push(issue('warning', 'SEO', 'Page language is missing', 'Add a lang attribute to the <html> element.'));
    }
    if (!viewports.length) {
      issues.push(issue('warning', 'SEO', 'Viewport metadata is missing', 'Add a responsive viewport declaration for mobile rendering.'));
    }
    if (!h1s.length) {
      issues.push(issue('warning', 'SEO', 'No H1 heading found', 'Use one clear primary heading for the page topic.'));
    } else if (h1s.length > 1) {
      issues.push(issue('info', 'SEO', 'Multiple H1 headings found', `${h1s.length} H1 headings are valid HTML, but the page hierarchy should remain clear.`));
    }

    const missingAlt = snapshot.images.filter((image) => !image.hasAlt).length;
    if (missingAlt) {
      issues.push(issue('warning', 'SEO', 'Images without alt attributes found', `${missingAlt} of ${snapshot.images.length} images have no alt attribute. Decorative images should use alt="".`));
    }

    const noindex = robots.some((value) => /(^|[,\s])noindex([,\s]|$)/i.test(value));
    const fields = [
      field('Title', title, title ? 'good' : 'error', title ? `${title.length} characters` : 'Missing'),
      field('Description', descriptions[0], descriptions.length ? 'good' : 'warning', descriptions[0] ? `${descriptions[0].length} characters` : 'Missing'),
      field('Canonical', canonical, canonicalLinks.length === 1 ? 'good' : canonicalLinks.length > 1 ? 'error' : 'warning', canonicalLinks.length > 1 ? `${canonicalLinks.length} declared` : ''),
      field('Robots', robots.join(' · '), noindex ? 'warning' : robots.length ? 'good' : 'warning', noindex ? 'Indexing is disabled' : robots.length ? '' : 'Not declared; browser defaults apply'),
      field('Language', language, language ? 'good' : 'warning', language ? '' : 'Missing html[lang]'),
      field('Viewport', viewports[0], viewports.length ? 'good' : 'warning', viewports.length ? '' : 'Missing'),
      field('H1 headings', h1s.join(' · '), h1s.length ? 'good' : 'warning', `${h1s.length} H1 · ${h2s.length} H2`),
      field('Image alt', `${snapshot.images.length - missingAlt} of ${snapshot.images.length} covered`, missingAlt ? 'warning' : 'good', missingAlt ? `${missingAlt} missing alt attributes` : ''),
      field('Hreflang', hreflangLinks.map((link) => `${link.hreflang}: ${resolveUrl(link.href, snapshot.url)}`).join(' · '), 'good', hreflangLinks.length ? `${hreflangLinks.length} alternate URLs` : 'None declared'),
    ];

    return {
      fields,
      issues,
      noindex,
      headings: { h1: h1s, h2: h2s },
      hreflang: hreflangLinks.map((link) => ({ language: link.hreflang, href: resolveUrl(link.href, snapshot.url) })),
    };
  }

  function analyzeSocial(snapshot) {
    const issues = [];
    const get = (key) => getMeta(snapshot, key)[0] || '';
    const openGraph = {
      title: get('og:title'),
      description: get('og:description'),
      image: resolveUrl(get('og:image'), snapshot.url),
      imageAlt: get('og:image:alt'),
      url: resolveUrl(get('og:url'), snapshot.url),
      type: get('og:type'),
      siteName: get('og:site_name'),
    };
    const twitter = {
      card: get('twitter:card'),
      title: get('twitter:title'),
      description: get('twitter:description'),
      image: resolveUrl(get('twitter:image'), snapshot.url),
      imageAlt: get('twitter:image:alt'),
      site: get('twitter:site'),
      creator: get('twitter:creator'),
    };
    const pageTitle = cleanText(snapshot.titleElements[0] || snapshot.documentTitle) || '(Untitled page)';
    const pageDescription = get('description');
    const canonicalLink = getLinks(snapshot, 'canonical')[0];
    const pageUrl = resolveUrl(canonicalLink && canonicalLink.href, snapshot.url) || safePageUrl(snapshot.url);
    let hostname = '';
    try { hostname = new URL(pageUrl).hostname; } catch { hostname = cleanText(pageUrl); }
    const openGraphTitle = openGraph.title || pageTitle;
    const openGraphDescription = openGraph.description || pageDescription;
    const openGraphUrl = openGraph.url || pageUrl;
    const socialSiteName = openGraph.siteName || hostname;
    const twitterTitle = twitter.title || openGraphTitle;
    const twitterDescription = twitter.description || openGraphDescription;
    const twitterImage = twitter.image || openGraph.image;
    const twitterImageAlt = twitter.imageAlt || openGraph.imageAlt;
    const previews = [
      {
        id: 'google',
        label: 'Google',
        title: pageTitle,
        description: pageDescription,
        url: pageUrl,
        siteName: socialSiteName,
        image: '',
        imageAlt: '',
        card: 'search-result',
      },
      {
        id: 'facebook',
        label: 'Facebook',
        title: openGraphTitle,
        description: openGraphDescription,
        url: openGraphUrl,
        siteName: socialSiteName,
        image: openGraph.image,
        imageAlt: openGraph.imageAlt,
        card: 'summary-large-image',
      },
      {
        id: 'x',
        label: 'X / Twitter',
        title: twitterTitle,
        description: twitterDescription,
        url: openGraphUrl,
        siteName: twitter.site || hostname,
        image: twitterImage,
        imageAlt: twitterImageAlt,
        card: twitter.card || (twitterImage ? 'summary_large_image' : 'summary'),
      },
      {
        id: 'linkedin',
        label: 'LinkedIn',
        title: openGraphTitle,
        description: openGraphDescription,
        url: openGraphUrl,
        siteName: socialSiteName,
        image: openGraph.image,
        imageAlt: openGraph.imageAlt,
        card: 'summary-large-image',
      },
    ];

    if (!openGraph.title) issues.push(issue('warning', 'Social', 'Open Graph title is missing', 'Social platforms may fall back to the page title.'));
    if (!openGraph.description) issues.push(issue('warning', 'Social', 'Open Graph description is missing', 'Add og:description for a controlled share preview.'));
    if (!openGraph.image) issues.push(issue('warning', 'Social', 'Open Graph image is missing', 'Add an absolute og:image URL for visual share cards.'));
    if (openGraph.image && !openGraph.imageAlt) issues.push(issue('info', 'Social', 'Open Graph image alt text is missing', 'Add og:image:alt to describe the image.'));
    if (!twitter.card && !openGraph.title) issues.push(issue('warning', 'Social', 'X/Twitter card metadata is missing', 'Declare twitter:card and core card fields, or provide complete Open Graph fallbacks.'));
    if (twitter.image && !twitter.imageAlt) issues.push(issue('info', 'Social', 'X/Twitter image alt text is missing', 'Add twitter:image:alt to describe the image.'));

    const fields = [
      field('og:title', openGraph.title, openGraph.title ? 'good' : 'warning'),
      field('og:description', openGraph.description, openGraph.description ? 'good' : 'warning'),
      field('og:image', openGraph.image, openGraph.image ? 'good' : 'warning'),
      field('og:image:alt', openGraph.imageAlt, openGraph.imageAlt ? 'good' : openGraph.image ? 'warning' : 'good'),
      field('og:url', openGraph.url, openGraph.url ? 'good' : 'warning'),
      field('og:type', openGraph.type, openGraph.type ? 'good' : 'warning'),
      field('twitter:card', twitter.card, twitter.card ? 'good' : 'warning'),
      field('twitter:title', twitter.title, twitter.title || openGraph.title ? 'good' : 'warning', !twitter.title && openGraph.title ? 'Open Graph fallback available' : ''),
      field('twitter:description', twitter.description, twitter.description || openGraph.description ? 'good' : 'warning', !twitter.description && openGraph.description ? 'Open Graph fallback available' : ''),
      field('twitter:image', twitter.image, twitter.image || openGraph.image ? 'good' : 'warning', !twitter.image && openGraph.image ? 'Open Graph fallback available' : ''),
    ];

    return { openGraph, twitter, previews, fields, issues };
  }

  function analyzeTracking(snapshot) {
    const sources = [];
    snapshot.scripts.forEach((script) => {
      if (script.src) sources.push({ kind: 'Script', value: script.src, searchable: script.src, external: true });
      if (!script.src && script.type !== 'application/ld+json' && script.text) {
        sources.push({ kind: 'Inline code', value: 'Exact inline signature', searchable: script.text, external: false });
      }
    });
    snapshot.images.forEach((image) => {
      if (image.src) sources.push({ kind: image.width <= 2 && image.height <= 2 ? 'Pixel image' : 'Image', value: image.src, searchable: image.src, external: true });
    });
    snapshot.iframes.forEach((frame) => {
      if (frame.src) sources.push({ kind: 'Iframe', value: frame.src, searchable: frame.src, external: true });
    });
    snapshot.links.forEach((link) => {
      if (link.href && /(?:preconnect|dns-prefetch)/i.test(link.rel || '')) {
        sources.push({ kind: 'Connection hint', value: link.href, searchable: link.href, external: true });
      }
    });
    snapshot.performanceEntries.forEach((url) => sources.push({ kind: 'Loaded resource', value: url, searchable: url, external: true }));
    snapshot.noscripts.forEach((text) => sources.push({ kind: 'Noscript', value: 'Noscript signature', searchable: text, external: false }));

    return TRACKER_RULES.map((rule) => {
      const evidence = [];
      sources.forEach((source) => {
        const urlMatch = rule.urls.some((pattern) => String(source.searchable || '').toLowerCase().includes(pattern.toLowerCase()));
        const inlineMatch = !source.external && rule.inline.some((pattern) => pattern.test(source.searchable || ''));
        if (!urlMatch && !inlineMatch) return;

        const value = source.external ? evidenceUrl(source.value, snapshot.url) : source.value;
        const key = `${source.kind}:${value}`;
        if (!evidence.some((item) => item.key === key) && evidence.length < MAX_EVIDENCE_PER_TRACKER) {
          evidence.push({ key, kind: source.kind, value });
        }
      });

      if (!evidence.length) return null;
      return {
        name: rule.name,
        category: rule.category,
        confidence: evidence.some((item) => ['Script', 'Pixel image', 'Iframe', 'Loaded resource'].includes(item.kind)) ? 'High' : 'Medium',
        evidence: evidence.map(({ kind, value }) => ({ kind, value })),
      };
    }).filter(Boolean);
  }

  function analyzeSnapshot(input) {
    const snapshot = {
      url: input.url || '',
      documentTitle: input.documentTitle || '',
      titleElements: input.titleElements || [],
      htmlLang: input.htmlLang || '',
      metas: input.metas || [],
      links: input.links || [],
      headings: input.headings || { h1: [], h2: [] },
      images: input.images || [],
      scripts: input.scripts || [],
      iframes: input.iframes || [],
      noscripts: input.noscripts || [],
      performanceEntries: input.performanceEntries || [],
      microdataItems: input.microdataItems || [],
      rdfaItems: input.rdfaItems || [],
    };

    const jsonLdScripts = snapshot.scripts.filter((script) => String(script.type || '').toLowerCase().split(';')[0].trim() === 'application/ld+json');
    const jsonLd = analyzeJsonLd(jsonLdScripts);
    const seo = analyzeSeo(snapshot);
    const social = analyzeSocial(snapshot);
    const tracking = analyzeTracking(snapshot);
    const schemaTypes = unique([
      ...jsonLd.items.flatMap((item) => item.types),
      ...snapshot.microdataItems.flatMap((item) => item.types || []),
      ...snapshot.rdfaItems.flatMap((item) => item.types || []),
    ]).sort((a, b) => a.localeCompare(b));
    const schemaItemCount = jsonLd.items.reduce((sum, item) => sum + (item.valid ? item.entityCount : 0), 0)
      + snapshot.microdataItems.length
      + snapshot.rdfaItems.length;
    const issues = [...jsonLd.issues, ...seo.issues, ...social.issues];
    const needsAttention = issues.filter((item) => item.severity === 'error' || item.severity === 'warning').length;

    return {
      generatedAt: new Date().toISOString(),
      page: {
        url: safePageUrl(snapshot.url),
        title: cleanText(snapshot.documentTitle) || '(Untitled page)',
      },
      summary: {
        schemaItems: schemaItemCount,
        needsAttention,
        errors: issues.filter((item) => item.severity === 'error').length,
        warnings: issues.filter((item) => item.severity === 'warning').length,
        informational: issues.filter((item) => item.severity === 'info').length,
        trackers: tracking.length,
        networkRequestsSentByExtension: 0,
      },
      structuredData: {
        jsonLd: jsonLd.items,
        microdata: snapshot.microdataItems,
        rdfa: snapshot.rdfaItems,
        types: schemaTypes,
      },
      seo,
      social,
      tracking,
      issues,
      limitations: [
        'Structural checks are not search-engine feature-eligibility validation.',
        'Tracker detection covers rendered markup and Performance API evidence only.',
        'Preview images stay blocked unless the user chooses to load their declared URLs directly.',
      ],
    };
  }

  function collectSnapshot(documentObject, performanceObject) {
    const document = documentObject;
    const performance = performanceObject;
    const attr = (element, name) => element.getAttribute(name) || '';
    const textList = (selector, limit = 20) => Array.from(document.querySelectorAll(selector))
      .slice(0, limit)
      .map((element) => cleanText(element.textContent))
      .filter(Boolean);

    const microdataItems = Array.from(document.querySelectorAll('[itemscope]')).slice(0, 50).map((element, index) => ({
      index: index + 1,
      types: unique(attr(element, 'itemtype').split(/\s+/).filter(Boolean).map((type) => type.replace(/^https?:\/\/schema\.org\//i, ''))),
      id: attr(element, 'itemid'),
      propertyCount: element.querySelectorAll('[itemprop]').length,
    }));

    const rdfaItems = Array.from(document.querySelectorAll('[typeof]')).slice(0, 50).map((element, index) => ({
      index: index + 1,
      types: unique(attr(element, 'typeof').split(/\s+/).filter(Boolean)),
      vocab: attr(element, 'vocab'),
      propertyCount: element.querySelectorAll('[property]').length,
    }));

    let performanceEntries = [];
    try {
      performanceEntries = performance && typeof performance.getEntriesByType === 'function'
        ? performance.getEntriesByType('resource').slice(0, 1500).map((entry) => entry.name).filter(Boolean)
        : [];
    } catch {
      performanceEntries = [];
    }

    return {
      url: document.location && document.location.href ? document.location.href : '',
      documentTitle: document.title,
      titleElements: textList('title', 5),
      htmlLang: attr(document.documentElement, 'lang'),
      metas: Array.from(document.querySelectorAll('meta')).slice(0, 300).map((element) => ({
        name: attr(element, 'name'),
        property: attr(element, 'property'),
        httpEquiv: attr(element, 'http-equiv'),
        content: attr(element, 'content'),
      })),
      links: Array.from(document.querySelectorAll('link')).slice(0, 300).map((element) => ({
        rel: attr(element, 'rel'),
        href: attr(element, 'href'),
        hreflang: attr(element, 'hreflang'),
        type: attr(element, 'type'),
      })),
      headings: {
        h1: textList('h1'),
        h2: textList('h2'),
      },
      images: Array.from(document.images).slice(0, 500).map((element) => ({
        src: element.currentSrc || attr(element, 'src'),
        hasAlt: element.hasAttribute('alt'),
        alt: attr(element, 'alt'),
        width: element.naturalWidth || element.width || 0,
        height: element.naturalHeight || element.height || 0,
      })),
      scripts: Array.from(document.scripts).slice(0, 500).map((element) => {
        const type = attr(element, 'type').toLowerCase();
        return {
          type,
          src: element.src || attr(element, 'src'),
          text: element.src ? '' : type.split(';')[0].trim() === 'application/ld+json'
            ? element.textContent || ''
            : truncate(element.textContent || '', MAX_INLINE_SOURCE),
        };
      }),
      iframes: Array.from(document.querySelectorAll('iframe')).slice(0, 200).map((element) => ({
        src: element.src || attr(element, 'src'),
      })),
      noscripts: Array.from(document.querySelectorAll('noscript')).slice(0, 100).map((element) => truncate(element.textContent || '', 20000)),
      performanceEntries,
      microdataItems,
      rdfaItems,
    };
  }

  function scanPage(documentObject, performanceObject) {
    return analyzeSnapshot(collectSnapshot(documentObject, performanceObject));
  }

  return {
    analyzeSnapshot,
    collectSnapshot,
    scanPage,
    safePageUrl,
    evidenceUrl,
  };
}));

typeof document !== 'undefined' ? globalThis.SEOMarkupAnalyzer.scanPage(document, performance) : undefined;
