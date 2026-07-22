# Olorin Privacy Policy

_Last updated: July 2026_

## What Olorin does

Olorin is a browser extension that bridges the browser and the Olorin
Companion App — a program installed on the same computer — so that receipts,
slips, and labels can print silently to the correct printer. It was
developed for libraries using the Koha integrated library system, but works
with any web application that embeds its print buttons.

## What data is handled

When a print button embedded in a web page (typically a Koha slip) is
activated — by a staff member or by the page's own print automation — the
extension reads the HTML of the specific element that button designates and
sends it to the Olorin Companion App over a local WebSocket connection
(`localhost:9696`). The companion app renders and prints it, then discards
it.

That is the only page data the extension touches. It is processed
transiently, on the user's own computer, solely to print.

## What is never done

- No browsing history, page content, credentials, or personal data is
  collected, stored, or transmitted to any external server.
- No analytics, telemetry, or tracking of any kind.
- No cookies are read or written.
- No third-party services are contacted.
- No remote code is loaded or executed.

## Printer settings

Printer preferences (which OS printer maps to each logical printer, page
sizes, margins) are stored by the Olorin Companion App in a local file on
the user's computer. They are never transmitted elsewhere.

## A note on patron data

Library slips may contain patron information (names, checkouts, holds).
Olorin sends that slip content only to the companion app on the same
computer for printing. It never leaves the machine.

## Contact

Questions about this policy: olorin@kylehall.info

Changes to this policy will be published in this repository and noted in
release notes.
