# SEOMarkup privacy statement

SEOMarkup inspects the page open in the active Chrome tab only after the user clicks the extension.

- All analysis happens locally in Chrome.
- No page data, browsing history, report, identifier, or usage event is sent to BusinessPress or any third party.
- The extension has no host permissions and cannot inspect sites in the background.
- The extension does not store scan history.
- The extension makes no network requests.
- Export and clipboard actions happen only after an explicit user click.

Chrome may block inspection of browser-internal pages, the Chrome Web Store, local files without file access enabled, and other protected surfaces.

The public website at `schema.businesspress.io` also offers a separate source-only inspection mode. It sends one user-submitted public URL to the BusinessPress server over POST, fetches up to 2 MB of source HTML, and returns the page to the active browser tab for analysis. The application creates no account, scan-history record, or saved report. Private/reserved addresses, login details, non-standard ports, oversized pages, and unsafe redirects are blocked.

The website contains no analytics, advertising pixels, account system, or contact form. Standard infrastructure logs may temporarily retain technical request details for security and reliable delivery. The target URL is in the POST body, not the endpoint path.
