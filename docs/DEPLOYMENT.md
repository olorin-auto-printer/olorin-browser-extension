# Enterprise deployment

How to force-install the Olorin extension on managed staff workstations so
librarians never have to install anything by hand. Pair this with deploying
the [Olorin Companion App](https://github.com/olorin-auto-printer/olorin-companion-app)
(set to run at login) through your usual software distribution tool.

There is nothing else to pre-configure in the browser: all printer settings
(mappings, page sizes, margins, copies, duplex) are stored by the companion
app on each machine, not in the extension.

## Chrome — `ExtensionInstallForcelist`

Chrome force-installs extensions listed in the `ExtensionInstallForcelist`
policy. Each entry is the Chrome Web Store item ID, optionally followed by
`;` and the update URL. Replace `EXTENSION_ID` below with the 32-character
ID from the extension's Chrome Web Store listing URL.

### Windows (registry / Group Policy)

Group Policy: `Computer Configuration → Administrative Templates → Google →
Google Chrome → Extensions → Configure the list of force-installed apps and
extensions`, or set the registry directly:

```reg
Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist]
"1"="EXTENSION_ID;https://clients2.google.com/service/update2/crx"
```

### macOS (configuration profile / plist)

Manage the `com.google.Chrome` domain via MDM, or for a quick local test:

```sh
defaults write com.google.Chrome ExtensionInstallForcelist -array-add \
  "EXTENSION_ID;https://clients2.google.com/service/update2/crx"
```

The equivalent payload in a configuration profile:

```xml
<key>ExtensionInstallForcelist</key>
<array>
  <string>EXTENSION_ID;https://clients2.google.com/service/update2/crx</string>
</array>
```

### Linux (managed policy JSON)

Create `/etc/opt/chrome/policies/managed/olorin.json`
(`/etc/chromium/policies/managed/olorin.json` for Chromium):

```json
{
  "ExtensionInstallForcelist": ["EXTENSION_ID;https://clients2.google.com/service/update2/crx"]
}
```

## Firefox — `policies.json` ExtensionSettings

Firefox force-installs extensions through the `ExtensionSettings` enterprise
policy, keyed by the add-on ID (`olorin@kylehall.info`). The `install_url`
points at the addons.mozilla.org "latest version" XPI URL — replace
`AMO_SLUG` with the slug (or numeric add-on ID) from the extension's AMO
listing URL:

```json
{
  "policies": {
    "ExtensionSettings": {
      "olorin@kylehall.info": {
        "installation_mode": "force_installed",
        "install_url": "https://addons.mozilla.org/firefox/downloads/latest/AMO_SLUG/latest.xpi"
      }
    }
  }
}
```

Save it as `policies.json` in Firefox's `distribution` directory:

- **Windows:** `C:\Program Files\Mozilla Firefox\distribution\policies.json`
- **macOS:** `/Applications/Firefox.app/Contents/Resources/distribution/policies.json`
- **Linux:** `/etc/firefox/policies/policies.json` (distribution packages) or
  `<install dir>/distribution/policies.json`

The same policy can be delivered via Windows Group Policy (ADMX templates)
or macOS configuration profiles if you already manage Firefox that way.

Force-installed extensions are granted their host permissions, so the
Firefox "Grant Access" prompt from a manual install does not apply.

## After deployment

On each workstation: run the companion app, click the Olorin toolbar icon
("Companion App Connected"), open Settings, and map the logical printers to
the real printers attached to that machine. The mapping is per-machine and
shared by every browser on it.
