# Store submission guide

Everything needed to submit Olorin 2.0.0 to the Chrome Web Store and
addons.mozilla.org (AMO). Build the packages first: `npm run check` then use
`web-ext-artifacts/olorin-chrome-2.0.0.zip` and
`web-ext-artifacts/olorin-firefox-2.0.0.zip`.

## Prerequisites

- **Chrome Web Store**: a developer account ($5 one-time fee) at
  https://chrome.google.com/webstore/devconsole
- **AMO**: a Firefox account at https://addons.mozilla.org/developers/
- **Privacy policy URL** (GitHub Pages, already enabled on this repo):
  https://olorin-auto-printer.github.io/olorin-browser-extension/PRIVACY.html
- The Firefox add-on ID is pinned to `olorin@bywatersolutions.com` in the
  manifest. It must never change once the first version is published.

## Listing copy (both stores)

- **Name**: Olorin
- **Summary** (≤132 chars CWS / ≤250 AMO): Silent receipt and label
  printing for the Koha library system via the Olorin Companion App.
- **Category**: Productivity (CWS) / Other or “Web Development” alternatives on AMO
- **Description**: reuse the "How it works" section of README.md, plus a
  link to the companion app releases page.
- **Screenshots** (CWS wants 1280×800 or 640×400; AMO is flexible): the
  popup showing "Companion App Connected", the printer settings page, and a
  Koha slip with the print button.
- **License (AMO)**: GPL-3.0

## Permission justifications (paste into the review forms)

**Broad host access / content script on `<all_urls>`:**

> Olorin adds silent receipt/label printing to the Koha integrated library
> system's staff interface. Each library hosts Koha on its own domain
> (self-hosted or vendor-hosted), so there is no finite list of URLs; the
> content script must be available on any page to detect the print buttons
> Koha embeds (`#webPrint` / `.olorinPlugin`). The script is passive: it
> only reacts when a user (or Koha's slip-printer setting) activates one of
> those buttons, then sends that slip's HTML to the Olorin Companion App
> listening on localhost:9696 on the same computer, which prints it. No page
> content is read, stored, or transmitted anywhere else. No remote code is
> loaded or executed.

**`localhost:9696` host permission:**

> Used exclusively for the WebSocket connection to the locally installed
> Olorin Companion App (source: the olorin-companion-app repository), which
> performs the actual printing. In Chrome this permission also exempts the
> connection from the Local Network Access prompt (Chrome 142+/147+).

**Reviewer notes (AMO):**

> This extension is a companion to the Koha ILS (open source library
> system, https://koha-community.org). The build is unminified and built
> from this public repository with `npm run build`; there is no bundler or
> transpiler — the files in the package are the files in `src/` plus a
> generated manifest.json. Data collection is declared as "none"
> (`browser_specific_settings.gecko.data_collection_permissions`). Nothing
> leaves the user's machine; the only network activity is a WebSocket to
> localhost:9696.

## Data disclosures

- **CWS data-usage form**: does not collect or use user data — check the
  "no data collected" attestations. Single purpose: printing Koha library
  slips via a local companion app.
- **AMO**: data collection declared in the manifest as `none`.

## Known review risks and answers

- _"Why `<all_urls>` instead of specific sites?"_ — Koha is self-hosted;
  every library has a different domain. There is no enumerable list.
  (Firefox users can also decline/revoke host access; the popup detects
  this and offers a grant button.)
- _"Why not Native Messaging?"_ — The companion app serves Chrome, Firefox,
  and any other browser with one WebSocket code path; native messaging
  would require per-browser host manifests and a per-browser install step
  on every workstation, complicating deployment for library IT.
- _addons-linter warning about `data_collection_permissions` vs Firefox for
  Android_ — informational only; the extension requires a desktop companion
  app and is not intended for Android.

## Submission steps

### Chrome Web Store

1. Dev console → New item → upload `olorin-chrome-2.0.0.zip`.
2. Fill the listing (copy above), privacy policy URL, and the privacy
   practices form ("no data collected").
3. In "Permissions justification", paste the two justifications above.
4. Submit for review. Broad host permissions trigger in-depth review — expect
   days to a couple of weeks.

### AMO

1. Developer Hub → Submit a New Add-on → On this site (listed) → upload
   `olorin-firefox-2.0.0.zip`.
2. AMO validates (matches our `npm run lint:firefox`), then asks for
   listing details; paste the reviewer notes above into "Notes to
   Reviewer".
3. Submit. AMO signs the add-on and serves the signed `.xpi` once approved.

## After approval

- Tag the release (`git tag v2.0.0`) so CI attaches the zips to a GitHub
  release.
- Update the companion app README installation links to point at the store
  listings.
