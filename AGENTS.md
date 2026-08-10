# SEOMarkup delivery guide

## Product boundary

SEOMarkup is a privacy-focused Chrome extension and public browser inspector. Extension inspection must remain local-only: no analytics, accounts, remote validation, browsing-history storage, background scanning, or outbound page-data requests. The web inspector may fetch one user-submitted public URL on the server, but it must clearly disclose that boundary, retain no scan history, use POST so target URLs do not enter normal request paths, and block private-network targets and unsafe redirects.

## Repository layout

- `extension/`: the load-unpacked Manifest V3 extension.
- `public/`: the site and guarded URL-inspection endpoint deployed at `schema.businesspress.io`.
- `tests/`: scanner, manifest, security, and public-site tests.
- `docs/screenshots/`: verified interface captures.

## Required checks

Run `npm run check`, `npm run package`, `unzip -t public/downloads/seomarkup-v0.1.0.zip`, and `git diff --check`. Verify the public site at desktop and 390px, keyboard focus, reduced motion, downloads, console output, canonical metadata, and the live extension archive.

## Delivery states

Report local, committed, pushed, Forge deployment, DNS/TLS, and production-browser verification separately. Never claim production from a successful push or deployment trigger alone.
