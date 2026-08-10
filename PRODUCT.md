# Product

## Audience

Marketers, developers, editors, and site owners who need to inspect a page quickly without granting a third-party extension permanent access to every website they visit.

## Job

Show what a page declares through Schema.org, SEO, social metadata, and common tracking tags. Offer two explicit modes: a source-only public URL report in the browser, and a rendered local-only report through the Chrome extension.

## Promise

SEOMarkup reports direct rendered-page evidence and clearly separates errors, warnings, and non-blocking guidance. It does not invent an SEO score or claim rich-result eligibility.

## Extension privacy boundary

- Runs only after the toolbar button is clicked.
- Requests only `activeTab` and `scripting`.
- Has no host permissions, accounts, analytics, saved history, or remote API.
- Loads declared social preview images only after an explicit click, directly from their source with no referrer.
- Redacts tracking query values in the UI and exports only after an explicit user action.

## Website inspection boundary

- Accepts one user-submitted public HTTP or HTTPS page over POST.
- Fetches source HTML once, returns it to the active browser tab for analysis, and keeps no application scan history.
- Blocks private, reserved, local, authenticated, non-standard-port, oversized, and unsafe redirect targets.
- Does not run the target page's JavaScript or automatically load linked assets. Declared social preview images load only after an explicit click.
- Clearly directs users to the extension when page data must stay entirely local.

## Public site

`schema.businesspress.io` provides the source inspector, explains the product, publishes the privacy statement, and serves the reviewed extension archive. The site itself contains no analytics or advertising pixels.
