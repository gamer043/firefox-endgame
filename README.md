# Firefox ENDGAME

A maximum-performance Firefox configuration. Every preference is verified against the Mozilla source code (`mozilla/gecko-dev`) — no myths, no deprecated prefs, no cargo-culted entries from 2015 blog posts.

**Status**: ~740 active `user_pref` entries. Tested on Firefox 140 ESR / Windows 11. Should work on any Firefox 128+ since most prefs are long-standing.

---

## What it does

### Performance (the boring-sounding stuff that actually matters)

- **GPU acceleration ON** with a surgical workaround for Discord screenshare DRM black-rectangle issue (disables Direct Composition video overlays only — keeps everything else GPU-composited)
- **Aggressive network**: HTTP/3 QUIC tuned (`use_nspr_for_io = false`, larger flow control windows), DNS predictor on, large DNS+TLS session caches, OCSP skipped for DV certs (CRLite handles it — saves 100-300 ms per new origin)
- **Eager content**: in-memory script cache surviving navigation, off-main-thread parse of `rel=preload` scripts, full eager script delazification, service workers kept warm 5 min (kills the 200 ms respawn lag on "instant" cached pages)
- **WebRender pipeline tuned**: thread-local arenas (Bug 1612440), Direct Composition compositor forced, retained display lists, paint rects separately
- **Image decoding**: 1 MB chunks, immediate decode, parallel on 12 threads, 4 GB surface cache
- **APZ scroll**: bigger displayport during fast scroll — no checkerboard
- **Background tab starvation**: `dom.min_background_timeout_value = 10000` (background `setTimeout(0)` becomes 10 s), foreground gets every frame
- **HTML parser**: bigger quantum (1024 nodes/slice vs default 200)
- **Zero UI animations** via `userChrome.css`
- **`content-visibility: auto`** via `userContent.css` for 20-40% LCP win on long pages (Reddit, GitHub, MDN, news/forums) — whitelisted to not break Discord/Gmail/Docs

### Bloat killed

Every telemetry endpoint, experiment system, A/B test framework, sponsored content slot, AI feature, promo URL, recommendation engine, and background polling task — disabled and where applicable the endpoint URL is blanked too (defense in depth).

- All `toolkit.telemetry.*`, `datareporting.*`, DAP, Glean / FOG, user characteristics ping
- Normandy / Shield / Nimbus / messaging-system / asrouter
- Pocket, Mozilla Monitor, VPN promos, FPN promos, mobile app promos
- Firefox Suggest, quicksuggest, sponsored topsites, Contile
- AI/ML chatbot sidebar, link preview, smart tab groups, content relevancy
- New Tab page feeds (snippets, topstories, weather, wallpapers, discoverystream)
- About:welcome, onboarding, "what's new" pages
- Webcompat reporter, addon abuse reporter, breach alerts
- Form autofill, push notifications, web notifications
- Geolocation, region detection, captive portal
- DoH (locked to mode 5 — explicitly off)
- Hardware media keys (so play/pause goes to Spotify, not Firefox)
- Default browser nag, background update agent
- Process hang reporting, DOM Reporting API, CSP reporting
- 32 log subsystems silenced (was Debug/Trace by default)

### Preserved

These work normally:
- Firefox Sync (all engines, real-time push left at defaults)
- Translations
- DRM / Widevine (Netflix, Disney+, Spotify)
- Spellcheck
- Service workers, WebRTC (Discord, Zoom, Meet)
- WebGL, WebGPU, Web Audio

### Privacy decisions

- `privacy.resistFingerprinting` is **not set** — breaks too many sites
- `privacy.firstparty.isolate` is **not set** — breaks Firefox Sync auth
- `network.cookie.cookieBehavior` left at default — anything stricter breaks Cloudflare challenges
- Tracking Protection (ETP), Global Privacy Control, social-tracking protection: **on**
- Built-in URL parameter stripping (`utm_*`, `fbclid`, `gclid`, etc.): **on**

---

## Install

### One-shot installer (Windows)

Download `install.bat` from the [latest release](../../releases/latest), double-click, done.

The installer:
1. Refuses to run if Firefox is open
2. Auto-detects your default Firefox profile
3. Backs up your existing `user.js` to `user.js.backup-<timestamp>`
4. Downloads `user.js`, `userChrome.css`, `userContent.css` from this repo
5. Places them in the right locations

### Manual install

1. Close Firefox.
2. Find your profile folder: type `about:profiles` in Firefox URL bar before you close, copy the **Root Directory** path.
3. Copy [`user.js`](user.js) to the root of the profile folder.
4. Create a `chrome` subfolder if it doesn't exist.
5. Copy [`userChrome.css`](userChrome.css) and [`userContent.css`](userContent.css) into the `chrome` subfolder.
6. Start Firefox.

The pref `toolkit.legacyUserProfileCustomizations.stylesheets = true` is included in `user.js` — required for the CSS files to load.

---

## Hardware notes

This config was tuned for high-end desktop (16+ CPU threads, 32 GB RAM, NVMe, RTX-class GPU). It works on lower-spec hardware too, but:

| If you have... | Consider changing |
|---|---|
| < 16 GB RAM | `dom.ipc.processCount` from `16` to `8` |
| < 8 GB RAM | Also lower `image.mem.surfacecache.max_size_kb` |
| Integrated GPU | Leave `gfx.webrender.compositor.force-enabled` and `low-quality-pinch-zoom` alone — defaults are safer |
| No NVMe (SATA SSD or HDD) | `browser.cache.disk.smart_size.enabled` stays `true` — it auto-sizes |

The values are biased toward "spend RAM and GPU for speed." Nothing here will break Firefox on weaker hardware, but you may be over-allocating caches.

---

## Maintenance

Optional [`firefox_maintenance.ps1`](firefox_maintenance.ps1) — run periodically with Firefox **closed**:

- Deletes dead-weight SQLite stores from disabled features (`suggest.sqlite`, `domain_to_categories.sqlite`)
- VACUUM + REINDEX + ANALYZE every SQLite database (places, favicons, cookies, etc.)
- Prunes `cache2/entries/` older than 30 days

Usually reclaims 100-300 MB and snaps up sqlite query times for the URL bar and history.

```powershell
powershell -ExecutionPolicy Bypass -File firefox_maintenance.ps1
```

---

## Rollback

The installer creates a timestamped backup of your previous `user.js` next to the new one. To roll back:

1. Close Firefox.
2. Delete the new `user.js` and rename the backup over it.
3. Delete `<profile>/chrome/userChrome.css` and `userContent.css` to remove the CSS overrides.
4. Start Firefox.

To temporarily disable individual prefs: edit `user.js` and prefix the offending line with `//`. Firefox re-reads `user.js` on every launch.

---

## Why these prefs and not [other config]?

- **No `network.http.pipelining.*`** — removed from Firefox 54 (Bug 1340655). Every guide listing this is stale.
- **No `privacy.resistFingerprinting`** — spoofs canvas, timezone, screen resolution, `performance.now()` precision. Breaks Cloudflare captchas, breaks site layouts, breaks site detection. Tor-level paranoia for browsers that aren't Tor.
- **No `privacy.firstparty.isolate`** — partitions cookies per first-party origin. Breaks OAuth, breaks Firefox Sync, breaks federated login.
- **No disk cache disable** — disabling disk cache *hurts* performance. Memory cache vanishes on restart, every navigation re-fetches.
- **No `webgl.disabled = true`** — modern sites use it for everything; disabling it makes you stand out more and reduces visible content.
- **No `network.http.speculative-parallel-limit = 0`** — disabling speculative connection adds a full TCP+TLS handshake to every navigation.

This config prioritizes **speed and bloat removal**, not maximum paranoia. If you want Tor-level privacy, use Tor Browser.

---

## License

MIT. Do what you want.

---

## Credits

Verified against:
- [mozilla/gecko-dev](https://github.com/mozilla/gecko-dev) — `modules/libpref/init/StaticPrefList.yaml`, `all.js`, `browser/app/profile/firefox.js`
- [Firefox source docs](https://firefox-source-docs.mozilla.org/) — performance best practices, networking, early hints
- Bugzilla bug references in user.js comments where relevant
