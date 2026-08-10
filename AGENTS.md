# SEOMarkup delivery guide

## Product boundary

SEOMarkup is a privacy-focused Chrome extension and its public download site. Page inspection must remain local-only: no analytics, accounts, remote validation, browsing-history storage, background scanning, or outbound page-data requests.

## Repository layout

- `extension/`: the load-unpacked Manifest V3 extension.
- `public/`: the static site deployed at `schema.businesspress.io`.
- `tests/`: scanner, manifest, security, and public-site tests.
- `docs/screenshots/`: verified interface captures.

## Required checks

Run `npm run check`, `npm run package`, `unzip -t public/downloads/seomarkup-v0.1.0.zip`, and `git diff --check`. Verify the public site at desktop and 390px, keyboard focus, reduced motion, downloads, console output, canonical metadata, and the live extension archive.

## Delivery states

Report local, committed, pushed, Forge deployment, DNS/TLS, and production-browser verification separately. Never claim production from a successful push or deployment trigger alone.
