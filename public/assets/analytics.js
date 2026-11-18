(function initWebsiteAnalytics() {
  'use strict';

  const origin = 'https://schema.businesspress.io';
  if (location.origin !== origin) return;

  const canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) return;
  const page = new URL(canonical.href);
  if (page.origin !== origin) return;
  const pageUrl = `${page.origin}${page.pathname}`;

  const script = document.createElement('script');
  script.src = 'https://stats.businesspress.io/js/pa-zvf5G3ZS18X4a1qAMM69M.js';
  script.referrerPolicy = 'no-referrer';
  script.addEventListener('load', () => {
    if (typeof window.plausible?.init !== 'function') return;

    window.plausible.init({
      autoCapturePageviews: false,
      outboundLinks: false,
      fileDownloads: false,
      formSubmissions: false,
      transformRequest(event) {
        if (event.n !== 'pageview') return null;
        const referrer = event.r ? new URL(event.r) : null;
        return { ...event, u: pageUrl, r: referrer?.host ? referrer.origin : null };
      },
    });
    window.plausible('pageview');
  }, { once: true });
  document.head.append(script);
})();
