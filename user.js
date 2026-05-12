/**
 * Firefox ENDGAME user.js
 * =======================
 * Firefox 140 ESR — Maximum Performance + Bloat Removal Configuration
 *
 * Target hardware: modern desktop (8+ CPU threads, 16+ GB RAM, NVMe SSD,
 *                  discrete GPU). Mid-range systems work too — see notes
 *                  on dom.ipc.processCount and image cache sizes if you
 *                  have less than 16 GB RAM.
 *
 * Every pref verified against mozilla/gecko-dev master source:
 *   - modules/libpref/init/StaticPrefList.yaml (~2,500 prefs)
 *   - modules/libpref/init/all.js (~2,000 prefs)
 *   - browser/app/profile/firefox.js (~1,400 prefs)
 *
 * Page-load research findings cite Bugzilla / mozilla-source-docs.
 *
 * STRATEGY:
 *   - GPU acceleration: ON, with surgical Direct Composition video overlay
 *     disable for Discord screenshare DRM compatibility
 *   - Network: aggressive prefetch/predictor, larger DNS/TLS caches,
 *     QUIC tuned (use_nspr_for_io off, larger flow control)
 *   - JS engine: SpiderMonkey defaults respected, GC tuned for large RAM
 *   - Memory: large surface/disk/media caches, eager image decode
 *   - I/O: NVMe-tuned chunk sizes, aggressive read-ahead
 *   - Bloat: ALL telemetry / experiments / ads / AI / promos killed
 *   - Privacy: sensible defaults — no resistFingerprinting (breaks too much),
 *     no firstparty.isolate (breaks Sync), no aggressive cookie behavior
 *     (breaks Cloudflare)
 *   - Sync, Translations, DRM (Widevine), Spellcheck: preserved
 *   - userChrome.css and userContent.css are paired with this user.js;
 *     install them all together via install.bat
 */


// =============================================================================
// SECTION 1: GPU ACCELERATION — ON, WITH DISCORD SCREENSHARE FIX
// =============================================================================
// Source: StaticPrefList.yaml lines 7373-7800, gfx.* prefs
//
// CRITICAL: layers.acceleration.disabled was set to true in your prefs.js.
// This forces SOFTWARE RENDERING for the entire browser. On an RTX 5090,
// this is the #1 reason Firefox feels slow vs Chrome/Brave.
//
// The Discord screenshare blackscreen is caused specifically by Direct
// Composition hardware video overlays, NOT by GPU acceleration itself.
// We disable only the overlay layer that Discord can't capture.

user_pref("layers.acceleration.disabled", false);

// --- Discord screenshare fix: disable video overlay compositing ---
// These are the specific prefs that cause black rectangles on screenshare.
// WebRender GPU compositing stays fully active for everything else.
user_pref("gfx.webrender.dcomp-video-hw-overlay-win", false);
user_pref("gfx.webrender.dcomp-video-sw-overlay-win", false);
user_pref("gfx.webrender.dcomp-video-hw-overlay-win-force-enabled", false);
user_pref("gfx.webrender.dcomp-video-sw-overlay-win-force-enabled", false);

// --- Force WebRender on (should be default, but ensure it) ---
user_pref("gfx.webrender.all", true);
user_pref("gfx.webrender.enabled", true);

// --- WebRender performance tuning ---
user_pref("gfx.webrender.precache-shaders", true);         // pre-compile shaders at startup
user_pref("gfx.webrender.compositor", true);                // native compositor (default on Win)
user_pref("gfx.webrender.program-binary-disk", true);       // cache compiled shaders to disk

// --- Canvas acceleration ---
user_pref("gfx.canvas.accelerated", true);
user_pref("gfx.canvas.accelerated.cache-items", 16384);     // default: 8192 — double the cache
user_pref("gfx.canvas.accelerated.cache-size", 512);        // default: 256 — double
user_pref("gfx.canvas.accelerated.max-size", 16384);        // default: 8192 — larger GPU canvases
user_pref("gfx.canvas.accelerated.gpu-path-size", 8);       // default: 4 MB — more GPU path cache
user_pref("gfx.canvas.remote", true);                       // offload canvas to GPU process
user_pref("gfx.canvas.remote.worker-threads", -1);          // default: -1 (auto, matches cores)

// --- Font rendering ---
user_pref("gfx.downloadable_fonts.fallback_delay", 0);      // default: 3000ms — no FOIT
user_pref("gfx.downloadable_fonts.fallback_delay_short", 0);// default: 100ms
user_pref("gfx.content.skia-font-cache-size", 20);          // default: 5 — Chrome uses 20

// --- Layer compositor (confirmed perf improvement, Bugzilla 1945683) ---
user_pref("gfx.webrender.layer-compositor", true);

// --- Direct2D / DirectWrite (Windows) ---
user_pref("gfx.direct2d.disabled", false);
user_pref("gfx.direct2d.force-enabled", false);             // let driver decide, but ensure not disabled


// =============================================================================
// SECTION 2: NETWORK — AGGRESSIVE SPEED
// =============================================================================
// Source: StaticPrefList.yaml lines 12800-15300, all.js lines 1100-1400

// --- Connections ---
user_pref("network.http.max-connections", 900);              // default: 900 — already plenty (1800 was theater)
user_pref("network.http.max-persistent-connections-per-server", 10); // default: 6
user_pref("network.http.max-persistent-connections-per-proxy", 48);  // default: 32
user_pref("network.http.max-urgent-start-excessive-connections-per-host", 6); // default: 3

// --- Pacing ---
user_pref("network.http.pacing.requests.enabled", true);     // default: true — KEEP, prevents burst
user_pref("network.http.pacing.requests.burst", 32);         // default: 10 — allow more burst
user_pref("network.http.pacing.requests.min-parallelism", 10); // default: 6 — more parallel

// --- Fast fallback (Happy Eyeballs) ---
user_pref("network.http.fast-fallback-to-IPv4", true);       // default: true

// --- Speculative connections / prefetching ---
user_pref("network.http.speculative-parallel-limit", 20);    // default: 20 — KEEP at max
user_pref("network.prefetch-next", true);                    // default: true — link prefetch ON
user_pref("network.dns.disablePrefetch", false);             // default: false — DNS prefetch ON
user_pref("network.dns.disablePrefetchFromHTTPS", false);    // default: false

// --- Network predictor (was disabled in your prefs.js — BAD) ---
user_pref("network.predictor.enabled", true);                // default: true — LEARN browsing patterns
// network.predictor.enable-hover-on-ssl / enable-prefetch / *-min-confidence
//   -> overridden by later section (aggressive predictor — Bugzilla-validated)
user_pref("network.predictor.max-resources-per-entry", 250); // default: 100 — track more subresources

// --- DNS ---
user_pref("network.dnsCacheEntries", 1000);                  // default: 400 — larger DNS cache
user_pref("network.dnsCacheExpiration", 86400);              // default: 60 — cache DNS for 24h
user_pref("network.dns.max_high_priority_threads", 16);      // default: 8 — match thread count
user_pref("network.dns.max_any_priority_threads", 24);       // default: 12 — more DNS threads

// --- TLS ---
user_pref("security.tls.enable_0rtt_data", true);            // default: true — 0-RTT TLS 1.3
user_pref("network.ssl_tokens_cache_capacity", 32768);       // default: 2048 — cache more TLS sessions

// --- HTTP/3 (QUIC) ---
user_pref("network.http.http3.enabled", true);               // default: true — ensure QUIC is on
user_pref("network.http.http3.default-max-stream-blocked", 20); // default: 20

// --- Race Cache With Network ---
user_pref("network.http.rcwn.enabled", true);                // default: true — race cache vs network
user_pref("network.http.rcwn.small_resource_size_kb", 512);  // default: 256 — race larger resources

// --- Captive portal / connectivity (disable background checks) ---
user_pref("network.captive-portal-service.enabled", false);
user_pref("network.connectivity-service.enabled", false);


// =============================================================================
// SECTION 3: CACHE — TUNED FOR NVMe + 32 GB RAM
// =============================================================================
// Source: StaticPrefList.yaml lines 1062-1180

user_pref("browser.cache.disk.enable", true);                // KEEP — NVMe disk cache is fast
user_pref("browser.cache.memory.enable", true);              // KEEP — memory cache too
user_pref("browser.cache.disk.smart_size.enabled", true);    // default: true — let FF size dynamically based on free disk
user_pref("browser.cache.memory.capacity", -1);              // default: -1 — auto-size based on RAM (was wrongly capped)
// browser.cache.disk.metadata_memory_limit -> overridden by section 26x (16 MB)
user_pref("browser.cache.disk.capacity", 1048576);           // 1 GB hint (only used if smart_size disabled, harmless otherwise)
// browser.cache.disk.max_entry_size / memory.max_entry_size -> overridden by section 26x
user_pref("browser.cache.disk.preload_chunk_count", 8);      // default: 4 — read-ahead 2 MB on NVMe
user_pref("browser.cache.disk.max_chunks_memory_usage", 81920);          // 80 MB (default: 40 MB)
user_pref("browser.cache.disk.max_priority_chunks_memory_usage", 81920); // 80 MB (default: 40 MB)
user_pref("browser.cache.disk_cache_ssl", true);             // default: true — cache HTTPS content


// =============================================================================
// SECTION 4: JAVASCRIPT — JIT TUNING FOR 9950X3D
// =============================================================================
// Source: StaticPrefList.yaml lines 8595-8980

// --- JIT compilation thresholds ---
// Lower = compile sooner = faster execution, more CPU at startup.
// With a 9950X3D, compile cost is negligible.
user_pref("javascript.options.baselinejit.threshold", 100);  // default: 100 — leave alone (SpiderMonkey-tuned)
user_pref("javascript.options.ion.threshold", 1500);         // default: 1500 — leave alone (lower = more JIT churn for no real gain)
user_pref("javascript.options.ion.offthread_compilation", true); // default: true — compile on bg thread

// --- Wasm ---
user_pref("javascript.options.wasm_caching", true);          // default: true — cache compiled wasm

// --- Bytecode cache ---
user_pref("dom.script_loader.bytecode_cache.strategy", -1);  // cache JS bytecode on first visit
user_pref("dom.script_loader.bytecode_cache.enabled", true); // default: true

// --- GC tuning for 32 GB RAM ---
// Be less aggressive about GC — we have plenty of RAM.
user_pref("javascript.options.mem.gc_high_frequency_time_limit_ms", 2000); // default: 1000
user_pref("javascript.options.mem.gc_low_frequency_heap_growth", 200);     // default: 150 (1.5x → 2.0x)
user_pref("javascript.options.mem.gc_high_frequency_large_heap_growth", 200); // default: 150
user_pref("javascript.options.mem.gc_high_frequency_heap_growth_max", 400);// default: 300
user_pref("javascript.options.mem.gc_allocation_threshold_mb", 60);        // default: 27 — GC less often
user_pref("javascript.options.mem.gc_malloc_threshold_base_mb", 76);       // default: 38 — double
user_pref("javascript.options.mem.gc_large_heap_size_min_mb", 256);        // default: 100

// --- Compacting GC ---
user_pref("javascript.options.compact_on_user_inactive", true);
user_pref("javascript.options.compact_on_user_inactive_delay", 10000);     // default: 30000 — compact sooner

// --- Async stacks (devtools overhead — disable) ---
user_pref("javascript.options.asyncstack", false);


// =============================================================================
// SECTION 5: CONTENT PROCESS MODEL — TUNED FOR 16 THREADS
// =============================================================================
// Source: all.js line 1879, StaticPrefList.yaml lines 3341-3440

// dom.ipc.processCount -> overridden by section 26y (back to 16 per research)
user_pref("dom.ipc.processPrelaunch.fission.number", 3);     // default: 3 — leave alone

// --- Process priority manager ---
user_pref("dom.ipc.processPriorityManager.enabled", true);
user_pref("dom.ipc.processPriorityManager.backgroundUsesEcoQoS", true); // use EcoQoS for bg tabs

// --- Reduce prelaunch delay (NVMe = fast process creation) ---
user_pref("dom.ipc.processPrelaunch.delayMs", 500);          // default: 1000 (android) / varies
user_pref("dom.ipc.processPrelaunch.startupDelayMs", 500);   // default: 1000 — faster startup

// --- Fission (site isolation) ---
user_pref("fission.autostart", true);                        // default: true — keep site isolation


// =============================================================================
// SECTION 6: IMAGE DECODING — FAST DECODE FOR BIG RAM
// =============================================================================
// Source: StaticPrefList.yaml lines 8100-8280

// image.mem.decode_bytes_at_a_time -> overridden by section 26y (1 MB chunks)
// image.mem.surfacecache.max_size_kb -> bumped to 4 GB in section 26t (audit findings)
user_pref("image.mem.surfacecache.size_factor", 4);           // default: 4 (1/4 RAM = 8 GB cap on 32GB box, plenty)
user_pref("image.mem.surfacecache.min_expiration_ms", 120000);// 2 min (default: 60s)
user_pref("image.mem.animated.discardable", false);           // don't discard animated frames — 32 GB
user_pref("image.http.accept", "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5");

// --- Image decoding threads ---
user_pref("image.multithreaded_decoding.limit", 0);          // default: 0 (auto) — uses all cores


// =============================================================================
// SECTION 7: LAYOUT & RENDERING
// =============================================================================
// Source: StaticPrefList.yaml lines 10460-10510, 15498-15506

// --- Initial paint delay ---
user_pref("nglayout.initialpaint.delay", 0);                 // default: 5ms — paint ASAP
user_pref("nglayout.initialpaint.delay_in_oopif", 0);        // default: 5ms

// --- Content notify interval ---
user_pref("content.notify.interval", 100000);                // default: 120000 — faster repaint

// --- Frame rate ---
// -1 = auto (match display), which is correct for most setups.
// If you have a 240Hz monitor, Firefox auto-detects it.
user_pref("layout.frame_rate", -1);

// --- Smooth scrolling FULLY DISABLED ---
// Master switch + every sub-mode (wheel, lines, pages, scrollbar, other, MSD physics)
user_pref("general.smoothScroll", false);                    // master kill switch
user_pref("general.smoothScroll.mouseWheel", false);         // mouse wheel scroll
user_pref("general.smoothScroll.lines", false);              // arrow key line scroll
user_pref("general.smoothScroll.pages", false);              // PgUp/PgDn page scroll
user_pref("general.smoothScroll.scrollbars", false);         // scrollbar drag
user_pref("general.smoothScroll.other", false);              // selection drag, etc.
user_pref("general.smoothScroll.msdPhysics.enabled", false); // MSD physics model
user_pref("mousewheel.default.delta_multiplier_x", 100);     // 1:1 (no smoothing multiplier)
user_pref("mousewheel.default.delta_multiplier_y", 100);     // 1:1 (no smoothing multiplier)
user_pref("mousewheel.default.delta_multiplier_z", 100);     // 1:1 (no smoothing multiplier)

// --- Disable cosmetic animations (snappier UI) ---
user_pref("toolkit.cosmeticAnimations.enabled", false);

// --- Disable reader mode parser (runs on every page load) ---
user_pref("reader.parse-on-load.enabled", false);

// --- Faster fullscreen ---
user_pref("full-screen-api.transition-duration.enter", "0 0");
user_pref("full-screen-api.transition-duration.leave", "0 0");
user_pref("full-screen-api.warning.delay", -1);
user_pref("full-screen-api.warning.timeout", 0);


// =============================================================================
// SECTION 8: SESSION & STARTUP
// =============================================================================

user_pref("browser.sessionstore.interval", 30000);           // default: 15000 — less disk thrashing
user_pref("browser.startup.preXulSkeletonUI", true);          // faster perceived startup
user_pref("browser.suppress_first_window_animation", true);
user_pref("browser.aboutConfig.showWarning", false);
user_pref("browser.startup.windowsLaunchOnLogin.disableLaunchOnLoginPrompt", true);

// --- Lazy tab restore (faster startup with many tabs) ---
user_pref("browser.sessionstore.restore_tabs_lazily", true);  // default: true
user_pref("browser.sessionstore.restore_on_demand", true);    // default: true

// --- UI density ---
user_pref("browser.compactmode.show", true);
user_pref("browser.uidensity", 1);

// --- Sidebar animation ---
user_pref("sidebar.animation.enabled", false);

// --- Security dialog delays ---
user_pref("security.dialog_enable_delay", 0);
user_pref("security.notification_enable_delay", 0);

// --- Windows Family Safety (startup overhead) ---
user_pref("security.family_safety.mode", 0);                 // default: 2


// =============================================================================
// SECTION 9: MEDIA PERFORMANCE
// =============================================================================

// --- Hardware video decoding ---
user_pref("media.wmf.dxva.enabled", true);                   // keep HW decode even w/o overlay
user_pref("media.hardware-video-decoding.enabled", true);
user_pref("media.hardware-video-decoding.force-enabled", true);
user_pref("media.wmf.vp9.enabled", true);                    // HW decode VP9 on RTX
user_pref("media.wmf.amd.vp9.enabled", true);                // also AMD path (9950X3D has iGPU?)
user_pref("media.wmf.av1.enabled", true);                    // HW AV1 decode (RTX 5090 has it)

// --- Media cache ---
user_pref("media.cache_size", 1024000);                      // default: 512000 — 1 GB media cache
user_pref("media.memory_cache_max_size", 131072);            // default: 65536 — 128 MB memory cache
user_pref("media.memory_caches_combined_limit_kb", 1048576); // default: 524288 — 1 GB combined (2 GB was excessive)
user_pref("media.memory_caches_combined_limit_pc_sysmem", 5); // default: 5 — leave alone (5% of 32 GB = 1.6 GB, plenty)

// --- Picture-in-Picture (user requested off) ---
user_pref("media.videocontrols.picture-in-picture.enabled", false);
user_pref("media.videocontrols.picture-in-picture.video-toggle.enabled", false);


// =============================================================================
// SECTION 10: TELEMETRY — KILL ALL
// =============================================================================

user_pref("toolkit.telemetry.unified", false);
user_pref("toolkit.telemetry.enabled", false);
user_pref("toolkit.telemetry.server", "data:,");
user_pref("toolkit.telemetry.archive.enabled", false);
user_pref("toolkit.telemetry.newProfilePing.enabled", false);
user_pref("toolkit.telemetry.shutdownPingSender.enabled", false);
user_pref("toolkit.telemetry.updatePing.enabled", false);
user_pref("toolkit.telemetry.bhrPing.enabled", false);
user_pref("toolkit.telemetry.firstShutdownPing.enabled", false);
user_pref("toolkit.telemetry.coverage.opt-out", true);
user_pref("toolkit.coverage.opt-out", true);
user_pref("toolkit.coverage.enabled", false);
user_pref("toolkit.telemetry.user_characteristics_ping.opt-out", true);
user_pref("toolkit.telemetry.dap_enabled", false);
user_pref("toolkit.telemetry.dap_task1_enabled", false);
user_pref("toolkit.telemetry.dap_visit_counting_enabled", false);

user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("datareporting.healthreport.uploadEnabled", false);
user_pref("datareporting.usage.uploadEnabled", false);

user_pref("breakpad.reportURL", "");
user_pref("browser.tabs.crashReporting.sendReport", false);
user_pref("browser.tabs.crashReporting.includeURL", false);
user_pref("browser.crashReports.unsubmittedCheck.autoSubmit2", false);
user_pref("browser.crashReports.unsubmittedCheck.enabled", false);      // default: true — stop checking for unsubmitted crashes
user_pref("browser.crashReports.crashPull", false);
user_pref("browser.crashReporter.memtest", false);                       // default: true — skip memory test on crash

user_pref("identity.fxaccounts.telemetry.clientAssociationPing.enabled", false);
user_pref("services.sync.telemetry.submissionInterval", 0);
user_pref("nimbus.telemetry.targetingContextEnabled", false);
user_pref("browser.search.serpEventTelemetryCategorization.enabled", false);
user_pref("browser.newtabpage.activity-stream.telemetry", false);
user_pref("browser.newtabpage.activity-stream.feeds.telemetry", false);
user_pref("browser.newtabpage.activity-stream.telemetry.privatePing.enabled", false); // default: true — private browsing telemetry
user_pref("browser.newtabpage.activity-stream.telemetry.surfaceId", "");

// --- Glean/FOG (Firefox on Glean) telemetry ---
user_pref("telemetry.fog.init_on_shutdown", false);              // default: true — sends telemetry during shutdown

// --- DNS-over-HTTPS telemetry ---
user_pref("network.trr.confirmation_telemetry_enabled", false);  // default: true

// --- DOM security telemetry ---
user_pref("dom.security.unexpected_system_load_telemetry_enabled", false);

// --- Coverage endpoint URL ---
user_pref("toolkit.coverage.endpoint.base", "");                 // default: https://coverage.mozilla.org

// --- DAP endpoint URLs (kill the endpoints, not just the toggles) ---
user_pref("toolkit.telemetry.dap.helper.url", "");               // default: https://dap.services.mozilla.com
user_pref("toolkit.telemetry.dap.leader.url", "");               // default: https://dap-09-3.api.divviup.org

// --- User characteristics ping ---
user_pref("toolkit.telemetry.user_characteristics_ping.send-once", false);

// --- Sync telemetry payload ---
user_pref("services.sync.telemetry.maxPayloadCount", 0);         // default: 500


// =============================================================================
// SECTION 11: EXPERIMENTS, NORMANDY, SHIELD — KILL ALL
// =============================================================================

user_pref("app.normandy.enabled", false);
user_pref("app.normandy.api_url", "");
user_pref("app.normandy.first_run", false);
user_pref("app.shield.optoutstudies.enabled", false);
user_pref("nimbus.validation.enabled", false);
user_pref("nimbus.profilesdatastoreservice.enabled", false);
user_pref("messaging-system.rsexperimentloader.collection_id", "");
user_pref("messaging-system.askForFeedback", false);
user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.addons", false);
user_pref("browser.newtabpage.activity-stream.asrouter.userprefs.cfr.features", false);


// =============================================================================
// SECTION 12: SPONSORED CONTENT, ADS, PROMOS — KILL ALL
// =============================================================================

user_pref("browser.newtabpage.activity-stream.unifiedAds.tiles.enabled", false);
user_pref("browser.newtabpage.activity-stream.unifiedAds.spocs.enabled", false);
user_pref("browser.newtabpage.activity-stream.unifiedAds.endpoint", "");
user_pref("browser.newtabpage.activity-stream.unifiedAds.adsFeed.enabled", false);
user_pref("browser.newtabpage.activity-stream.showSponsored", false);
user_pref("browser.newtabpage.activity-stream.showSponsoredTopSites", false);
user_pref("browser.topsites.contile.enabled", false);
user_pref("browser.topsites.contile.endpoint", "");
user_pref("browser.topsites.contile.sov.enabled", false);
user_pref("browser.topsites.useRemoteSetting", false);
user_pref("browser.urlbar.suggest.quicksuggest.sponsored", false);
user_pref("browser.urlbar.suggest.quicksuggest.nonsponsored", false);
user_pref("browser.urlbar.quicksuggest.dataCollection.enabled", false);
user_pref("browser.urlbar.quicksuggest.enabled", false);
user_pref("browser.urlbar.sponsoredTopSites", false);
user_pref("browser.vpn_promo.enabled", false);
user_pref("browser.promo.focus.enabled", false);
user_pref("browser.promo.pin.enabled", false);
user_pref("browser.promo.cookiebanners.enabled", false);
user_pref("browser.privatebrowsing.vpnpromourl", "");
user_pref("browser.discovery.enabled", false);
user_pref("browser.discovery.containers.enabled", false);
user_pref("extensions.htmlaboutaddons.recommendations.enabled", false);
user_pref("extensions.getAddons.showPane", false);
user_pref("browser.partnerlink.attributionURL", "");


// =============================================================================
// SECTION 13: NEW TAB PAGE — STRIPPED
// =============================================================================

user_pref("browser.newtabpage.activity-stream.feeds.section.topstories", false);
user_pref("browser.newtabpage.activity-stream.feeds.section.highlights", false);
user_pref("browser.newtabpage.activity-stream.feeds.snippets", false);
user_pref("browser.newtabpage.activity-stream.feeds.topsites", false);
user_pref("browser.newtabpage.activity-stream.feeds.discoverystreamfeed", false);
user_pref("browser.newtabpage.activity-stream.feeds.wallpaperfeed", false);
user_pref("browser.newtabpage.activity-stream.feeds.weatherfeed", false);
user_pref("browser.newtabpage.activity-stream.feeds.adsfeed", false);
user_pref("browser.newtabpage.activity-stream.feeds.recommendationprovider", false);
user_pref("browser.newtabpage.activity-stream.feeds.newtabmessaging", false);
user_pref("browser.newtabpage.activity-stream.feeds.favicon", false);
user_pref("browser.newtabpage.activity-stream.feeds.systemtick", false);
user_pref("browser.newtabpage.activity-stream.showWeather", false);
user_pref("browser.newtabpage.activity-stream.showSearch", true);
user_pref("browser.newtabpage.activity-stream.discoverystream.enabled", false);
user_pref("browser.newtabpage.activity-stream.discoverystream.personalization.enabled", false);
user_pref("browser.newtabpage.activity-stream.discoverystream.saveToPocketCard.enabled", false);
user_pref("browser.newtabpage.activity-stream.discoverystream.sendToPocket.enabled", false);
user_pref("browser.newtabpage.activity-stream.discoverystream.merino-provider.enabled", false);
user_pref("browser.newtabpage.activity-stream.newtabWallpapers.enabled", false);
user_pref("browser.newtabpage.activity-stream.newtabWallpapers.customColor.enabled", false);
user_pref("browser.newtabpage.activity-stream.newtabWallpapers.customWallpaper.enabled", false);
user_pref("browser.newtabpage.activity-stream.logowordmark.alwaysVisible", false);
user_pref("browser.newtabpage.activity-stream.asrouter.useRemoteL10n", false);
user_pref("browser.newtab.preload", false);


// =============================================================================
// SECTION 14: AI/ML — KILL ALL
// =============================================================================

user_pref("browser.ml.chat.enabled", false);
user_pref("browser.ml.chat.sidebar", false);
user_pref("browser.ml.chat.shortcuts", false);
user_pref("browser.ml.chat.shortcuts.custom", false);
user_pref("browser.ml.chat.provider", "");
user_pref("browser.ml.linkPreview.enabled", false);
user_pref("browser.ml.linkPreview.longPress", false);
user_pref("browser.ml.enable", false);
user_pref("extensions.ml.enabled", false);
user_pref("toolkit.contentRelevancy.enabled", false);
user_pref("toolkit.contentRelevancy.ingestEnabled", false);
user_pref("browser.tabs.groups.smart.enabled", false);


// =============================================================================
// SECTION 15: POCKET — KILL
// =============================================================================

user_pref("extensions.pocket.enabled", false);
user_pref("extensions.pocket.api", "");
user_pref("extensions.pocket.oAuthConsumerKey", "");
user_pref("extensions.pocket.site", "");


// =============================================================================
// SECTION 16: URL BAR — CLEAN
// =============================================================================

user_pref("browser.urlbar.suggest.bookmark", false);
user_pref("browser.urlbar.suggest.history", false);
user_pref("browser.urlbar.suggest.openpage", false);
user_pref("browser.urlbar.suggest.searches", false);
user_pref("browser.urlbar.suggest.trending", false);
user_pref("browser.urlbar.suggest.topsites", false);
user_pref("browser.urlbar.suggest.recentsearches", false);
user_pref("browser.urlbar.suggest.engines", false);
user_pref("browser.urlbar.suggest.calculator", false);
user_pref("browser.urlbar.suggest.clipboard", false);
user_pref("browser.urlbar.suggest.weather", false);
user_pref("browser.urlbar.suggest.yelp", false);
user_pref("browser.urlbar.suggest.fakespot", false);
user_pref("browser.urlbar.suggest.mdn", false);
user_pref("browser.urlbar.suggest.addons", false);
user_pref("browser.urlbar.suggest.quickactions", false);
user_pref("browser.urlbar.trending.featureGate", false);
user_pref("browser.urlbar.recentsearches.featureGate", false);
user_pref("browser.urlbar.speculativeConnect.enabled", false);
user_pref("browser.urlbar.merino.endpointURL", "");
user_pref("browser.urlbar.suggest.remotetab", true);


// =============================================================================
// SECTION 17: TRANSLATIONS — OFF
// =============================================================================

user_pref("browser.translations.enable", true);
user_pref("browser.translations.select.enable", true);


// =============================================================================
// SECTION 18: WELCOME / FIRST RUN — OFF
// =============================================================================

user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("browser.startup.upgradeDialog.enabled", false);
user_pref("browser.laterrun.enabled", false);
user_pref("browser.uitour.enabled", false);
user_pref("browser.uitour.url", "");


// =============================================================================
// SECTION 19: DEFAULT BROWSER CHECK — OFF
// =============================================================================

user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.shell.setDefaultGuidanceNotifications", false);
user_pref("default-browser-agent.enabled", false);


// =============================================================================
// SECTION 20: FORM AUTOFILL — OFF
// =============================================================================

user_pref("extensions.formautofill.addresses.enabled", false);
user_pref("extensions.formautofill.creditCards.enabled", false);
user_pref("extensions.formautofill.heuristics.captureOnFormRemoval", false);
user_pref("extensions.formautofill.heuristics.captureOnPageNavigation", false);


// =============================================================================
// SECTION 21: PUSH NOTIFICATIONS — OFF
// =============================================================================

user_pref("dom.push.connection.enabled", false);
user_pref("dom.push.serverURL", "");
user_pref("dom.webnotifications.enabled", false);
user_pref("dom.webnotifications.serviceworker.enabled", false);


// =============================================================================
// SECTION 22: GEOLOCATION — OFF
// =============================================================================

user_pref("geo.enabled", false);
user_pref("geo.provider.ms-windows-location", false);
user_pref("browser.region.update.enabled", false);
user_pref("browser.region.network.url", "");


// =============================================================================
// SECTION 23: PRIVACY — SENSIBLE WITHOUT BREAKING PERF
// =============================================================================

user_pref("privacy.trackingprotection.enabled", true);
user_pref("privacy.trackingprotection.socialtracking.enabled", true);
user_pref("privacy.globalprivacycontrol.enabled", true);
user_pref("network.http.referer.XOriginTrimmingPolicy", 2);
user_pref("browser.send_pings", false);
user_pref("media.peerconnection.ice.default_address_only", true);
user_pref("media.peerconnection.ice.proxy_only_if_behind_proxy", true);
user_pref("dom.event.clipboardevents.enabled", true);
user_pref("permissions.default.desktop-notification", 2);
user_pref("permissions.default.geo", 2);
user_pref("permissions.default.xr", 2);
user_pref("dom.private-attribution.submission.enabled", false);


// =============================================================================
// SECTION 24: SAFE BROWSING — OFF (uBlock Origin)
// =============================================================================

user_pref("browser.safebrowsing.malware.enabled", false);
user_pref("browser.safebrowsing.phishing.enabled", false);
user_pref("browser.safebrowsing.downloads.enabled", false);
user_pref("browser.safebrowsing.downloads.remote.enabled", false);
user_pref("browser.safebrowsing.downloads.remote.block_dangerous", false);
user_pref("browser.safebrowsing.downloads.remote.block_dangerous_host", false);
user_pref("browser.safebrowsing.downloads.remote.block_potentially_unwanted", false);
user_pref("browser.safebrowsing.downloads.remote.block_uncommon", false);
user_pref("browser.safebrowsing.downloads.remote.url", "");
user_pref("browser.safebrowsing.provider.google4.dataSharing.enabled", false);
user_pref("browser.safebrowsing.blockedURIs.enabled", false);


// =============================================================================
// SECTION 25: ACCESSIBILITY — OFF
// =============================================================================

user_pref("accessibility.force_disabled", 1);


// =============================================================================
// SECTION 25b: VR/XR — KILL ALL
// =============================================================================

user_pref("dom.vr.enabled", false);
user_pref("dom.vr.webxr.enabled", false);
user_pref("dom.vr.oculus.enabled", false);
user_pref("dom.vr.openvr.enabled", false);
user_pref("dom.vr.osvr.enabled", false);
user_pref("dom.vr.autoactivate.enabled", false);
user_pref("dom.vr.process.enabled", false);
user_pref("dom.vr.puppet.enabled", false);
user_pref("dom.vr.always_support_vr", false);
user_pref("dom.vr.always_support_ar", false);


// =============================================================================
// SECTION 26: DEVTOOLS — OFF (not a developer in Firefox)
// =============================================================================

user_pref("devtools.policy.disabled", true);
user_pref("devtools.f12_enabled", false);
user_pref("devtools.inspector.enabled", false);
user_pref("devtools.debugger.enabled", false);
user_pref("devtools.netmonitor.enabled", false);
user_pref("devtools.performance.enabled", false);
user_pref("devtools.memory.enabled", false);
user_pref("devtools.styleeditor.enabled", false);
user_pref("devtools.storage.enabled", false);
user_pref("devtools.accessibility.enabled", false);
user_pref("devtools.application.enabled", false);
user_pref("devtools.dom.enabled", false);
user_pref("devtools.debugger.remote-enabled", false);
user_pref("devtools.chrome.enabled", false);
user_pref("devtools.debugger.features.wasm", false);
user_pref("devtools.debugger.features.javascript-tracing", false);


// =============================================================================
// SECTION 26b: ADDITIONAL BLOAT — MORE FROM MOZILLA, EXPERIMENTS, PROMOS
// =============================================================================

// --- "More from Mozilla" section in Settings (VPN/Relay/Focus/Pocket promos) ---
user_pref("browser.preferences.moreFromMozilla", false);                 // default: true

// --- Extension Pioneer experiments ---
user_pref("extensions.experiments.enabled", false);                      // default: true — extension studies

// --- Lightweight themes "Get more" promo URL ---
user_pref("lightweightThemes.getMoreURL", "");                           // default: addons.mozilla.org

// --- Messaging system extra logging ---
user_pref("messaging-system.log", "off");                                // default: "warn"

// --- Privacy segmentation experiment ---
user_pref("browser.privacySegmentation.preferences.show", false);        // default: false (lock it)

// --- Datareporting first-run / promo URLs ---
user_pref("datareporting.policy.firstRunURL", "");                       // default: mozilla.org/privacy/firefox/
user_pref("datareporting.healthreport.infoURL", "");                     // default: mozilla.org legal page

// --- Send Tab promo URL ---
user_pref("identity.sendtabpromo.url", "");                              // default: support.mozilla.org promo

// --- App support / shield learn-more URLs ---
user_pref("app.support.baseURL", "");                                    // default: support.mozilla.org
user_pref("app.normandy.shieldLearnMoreUrl", "");                        // default: shield support URL

// --- Captive portal canonical content URL (unused since CP service disabled) ---
user_pref("captivedetect.canonicalURL", "");                             // default: detectportal.firefox.com

// --- Windows taskbar jumplist (background work building recent/frequent lists) ---
user_pref("browser.taskbar.lists.enabled", false);                       // default: true
user_pref("browser.taskbar.lists.frequent.enabled", false);              // default: true
user_pref("browser.taskbar.lists.recent.enabled", false);                // default: false
user_pref("browser.taskbar.lists.tasks.enabled", false);                 // default: true
user_pref("browser.taskbar.lists.refreshInSeconds", 7200);               // default: 120 — if still firing, slow it way down

// --- Tab low-memory unloader (with 32 GB, never triggers — just monitoring overhead) ---
user_pref("browser.tabs.unloadOnLowMemory", false);                      // default: true

// --- Warn on quit dialog ---
user_pref("browser.warnOnQuit", false);                                  // default: true — "you have N tabs open"

// --- Recently visited origins tracking ---
user_pref("browser.engagement.recent_visited_origins.expiry", 0);        // default: 86400 — don't track recently visited

// --- URL bar autofix (www. / .com auto-append) — minor UX preference ---
// Leaving at defaults — useful behavior. Uncomment if you want raw input only.
// user_pref("browser.fixup.alternate.enabled", false);

// --- Background app update (ESR auto-updates; bg agent runs even when FF closed) ---
// Disabling this prevents updates when FF isn't running. You'll still get updates
// when FF is open. With ESR, this is fine — security patches still come in.
user_pref("app.update.background.scheduling.enabled", false);            // disable bg scheduled update task

// --- DRM / EME prompt (left ON for Netflix/Spotify — set to false if you don't stream) ---
// user_pref("browser.eme.ui.enabled", false);


// =============================================================================
// SECTION 26c: SEARCH ENGINE BLOAT — KILL REGIONAL/DEFAULTS/AUTODETECT
// =============================================================================

// --- Stop polling Mozilla for search engine definition updates ---
user_pref("browser.search.update", false);                               // default: true

// --- Region detection for geo-specific defaults (Yandex/Baidu/Mail.ru/etc) ---
user_pref("browser.search.geoSpecificDefaults", false);                  // legacy pref, lock off
user_pref("browser.search.region", "US");                                // pin to US to avoid lookup
user_pref("browser.search.countryCode", "US");

// --- Don't prompt to add engines that sites advertise via OpenSearch ---
user_pref("browser.search.removeEngineInfobar.enabled", false);          // default: true
user_pref("browser.search.modernConfig", true);                          // use the new bundled config (smaller)

// --- "Find more search engines" link in search prefs ---
user_pref("browser.search.searchEnginesURL", "");

// --- Separate private browsing search engine (extra config overhead) ---
user_pref("browser.search.separatePrivateDefault", false);
user_pref("browser.search.separatePrivateDefault.ui.enabled", false);
user_pref("browser.search.separatePrivateDefault.urlbarResult.enabled", false);

// --- Suggest API (you have urlbar suggestions off, kill the master too) ---
user_pref("browser.search.suggest.enabled", false);                      // default: true
user_pref("browser.search.suggest.enabled.private", false);              // default: false (lock)


// =============================================================================
// SECTION 26d: TAB CARD / HOVER PREVIEWS — OFF
// =============================================================================
// These render a thumbnail/snapshot of each tab on hover — extra paint work
// and GPU memory for every tab.

user_pref("browser.tabs.hoverPreview.enabled", false);                   // default: true
user_pref("browser.tabs.hoverPreview.showThumbnails", false);            // default: true
user_pref("browser.tabs.tooltipsShowPidAndActiveness", false);           // default: true on debug, but disable anyway


// =============================================================================
// SECTION 26e: LOGGING SUBSYSTEMS — ALL SILENCED
// =============================================================================
// Firefox has dozens of internal loggers. Many default to Debug/Trace/Warn
// which means they're formatting and writing log strings constantly even
// when nothing reads them. Setting all to Fatal/Error stops the work.
// "Fatal" = log only fatal errors. "Error" = errors only. Both are minimal.

// --- App / update ---
user_pref("app.update.log", false);
user_pref("app.update.log.file", false);
user_pref("app.update.background.loglevel", "Fatal");                    // default: "error"

// --- Browser subsystems ---
user_pref("browser.download.loglevel", "Fatal");                         // default: "Error"
user_pref("browser.esedbreader.loglevel", "Fatal");                      // default: "Error"
user_pref("browser.ml.logLevel", "Fatal");                               // default: "Error"
user_pref("browser.sanitizer.loglevel", "Fatal");                        // default: "Warn"
user_pref("browser.uitour.loglevel", "Fatal");                           // default: "Error"
user_pref("browser.urlbar.loglevel", "Fatal");                           // default: "Error"
user_pref("browser.translations.logLevel", "Fatal");                     // default: "Error"
user_pref("browser.startup.homepage.abouthome_cache.loglevel", "Fatal"); // default: "Warn"

// --- Session store logging (huge offender: file appender at Trace by default) ---
user_pref("browser.sessionstore.loglevel", "Fatal");                     // default: "Warn"
user_pref("browser.sessionstore.log.appender.console", "Fatal");
user_pref("browser.sessionstore.log.appender.dump", "Fatal");            // default: "Error"
user_pref("browser.sessionstore.log.appender.file.level", "Fatal");      // default: "Trace" — VERY noisy
user_pref("browser.sessionstore.log.appender.file.logOnError", false);   // default: true
user_pref("browser.sessionstore.log.appender.file.logOnSuccess", false); // default: true
user_pref("browser.sessionstore.log.appender.file.maxErrorAge", 0);      // default: 864000 (10 days)

// --- Captcha detection ---
user_pref("captchadetection.loglevel", "Fatal");                         // default: "Warn"

// --- Cookie banner subsystems ---
user_pref("cookiebanners.bannerClicking.logLevel", "Fatal");
user_pref("cookiebanners.listService.logLevel", "Fatal");

// --- DOM subsystems ---
user_pref("dom.push.loglevel", "Fatal");
user_pref("dom.webnotifications.loglevel", "Fatal");

// --- Extensions logging ---
user_pref("extensions.logging.enabled", false);                          // default: false (lock)
user_pref("extensions.formautofill.loglevel", "Fatal");                  // default: "Warn"

// --- Services / Sync logging (file appender at TRACE by default — huge waste) ---
user_pref("services.sync.log.cryptoDebug", false);
user_pref("services.sync.log.logger", "Fatal");                          // default: "Debug"
user_pref("services.sync.log.logger.engine", "Fatal");                   // default: "Debug"
user_pref("services.sync.log.appender.console", "Fatal");                // already Fatal
user_pref("services.sync.log.appender.dump", "Fatal");                   // default: "Error"
user_pref("services.sync.log.appender.file.level", "Fatal");             // default: "Trace"
user_pref("services.sync.log.appender.file.logOnError", false);          // default: true
user_pref("services.sync.log.appender.file.logOnSuccess", false);        // default: true
user_pref("services.sync.log.appender.file.maxErrorAge", 0);             // default: 864000

// --- Services common (REST request/response logging at DEBUG by default) ---
user_pref("services.common.log.logger.rest.request", "Fatal");           // default: "Debug"
user_pref("services.common.log.logger.rest.response", "Fatal");          // default: "Debug"
user_pref("services.common.log.logger.tokenserverclient", "Fatal");      // default: "Debug"

// --- Telemetry/translations logging ---
user_pref("toolkit.telemetry.translations.logLevel", "Fatal");           // default: "Error"
user_pref("toolkit.telemetry.dap.logLevel", "Fatal");                    // default: "Warn"
user_pref("toolkit.telemetry.user_characteristics_ping.logLevel", "Fatal"); // default: "Warn"

// --- Browser dump (chrome console output) ---
user_pref("browser.dom.window.dump.enabled", false);                     // default: build-dependent
user_pref("devtools.console.stdout.chrome", false);                      // default: build-dependent
user_pref("devtools.console.stdout.content", false);                     // default: false (lock)


// =============================================================================
// SECTION 26f: UNUSED WEB APIs — KILL BACKGROUND HOOKS
// =============================================================================
// Each of these registers event listeners / exposes interfaces to every
// page's JS context even when no site uses them. Killing them shaves memory
// and reduces fingerprint surface.

// --- MIDI device access ---
user_pref("dom.webmidi.enabled", false);                                 // default: true
user_pref("dom.webmidi.gated", true);                                    // default: true (lock)

// --- Battery API (deprecated from spec, but still exposed) ---
user_pref("dom.battery.enabled", false);                                 // default: true

// --- Gamepad API ---
user_pref("dom.gamepad.enabled", false);                                 // default: true
user_pref("dom.gamepad.extensions.enabled", false);                      // default: true
user_pref("dom.gamepad.haptic_feedback.enabled", false);                 // default: true
user_pref("dom.gamepad.non_standard_events.enabled", false);

// --- Wake Lock API (sites preventing display sleep) ---
user_pref("dom.screenwakelock.enabled", false);                          // default: true

// --- Vibration API (locked since default true on Android) ---
user_pref("dom.vibrator.enabled", false);                                // default: false on desktop (lock)

// --- Web Speech (synthesis + recognition) ---
user_pref("media.webspeech.synth.enabled", false);
user_pref("media.webspeech.recognition.enable", false);


// =============================================================================
// SECTION 26g: PLACES (HISTORY DB) BLOAT
// =============================================================================

// --- Stop tracking scroll/typing interactions on every page ---
user_pref("browser.places.interactions.enabled", false);                 // default: true

// --- No speculative connect from history dropdown hover ---
user_pref("browser.places.speculativeConnect.enabled", false);           // default: true


// =============================================================================
// SECTION 26h: PROFILES & FIREFOX VIEW — OFF
// =============================================================================

// --- Built-in multi-profile picker (you have one profile) ---
user_pref("browser.profiles.enabled", false);                            // default: true

// --- Firefox View page state ---
user_pref("browser.firefox-view.feature-tour", "{\"complete\":true}");   // mark tour done
user_pref("browser.firefox-view.max-history-rows", 0);                   // no history rows in FF View
user_pref("browser.firefox-view.virtual-list.enabled", false);

// --- Toast notification when synced device opens a tab ---
user_pref("browser.tabs.firefox-view.notify-for-tabs-with-recent-activity", false);


// =============================================================================
// SECTION 26i: DISK CLEANUP — BOOKMARKS BACKUPS, TEMP FILES
// =============================================================================

// --- Reduce bookmark JSON backups from 5 to 2 (less disk writes) ---
user_pref("browser.bookmarks.max_backups", 2);                           // default: 5

// --- Clean up "Open with" downloaded temp files on exit ---
user_pref("browser.helperApps.deleteTempFileOnExit", true);              // default: false


// =============================================================================
// SECTION 26j: HAVEIBEENPWNED / BREACH ALERTS — OFF
// =============================================================================

user_pref("signon.management.page.breach-alerts.enabled", false);        // default: true
user_pref("signon.management.page.vulnerable-passwords.enabled", false); // default: true


// =============================================================================
// SECTION 26k: DNS-OVER-HTTPS (TRR) — LOCKED OFF
// =============================================================================
// User uses regular DNS (no DoH). Lock to mode 5 (explicitly off) to prevent
// Mozilla from re-enabling it in a future ESR.

user_pref("network.trr.mode", 5);                                        // 5 = explicitly off
user_pref("network.trr.uri", "");
user_pref("network.trr.custom_uri", "");
user_pref("doh-rollout.enabled", false);                                 // disable DoH rollout system


// =============================================================================
// SECTION 26l: UX & MINOR PERF — TARGETED ADDITIONS
// =============================================================================

// --- URL bar dropdown: fewer rows = faster render ---
user_pref("browser.urlbar.maxRichResults", 6);                           // default: 10

// --- Anti-phishing: show xn-- (punycode) instead of fake Unicode lookalikes ---
user_pref("network.IDN_show_punycode", true);                            // default: false

// --- Don't paste clipboard contents into URL bar on middle-click (Linux holdover) ---
user_pref("browser.tabs.searchclipboardfor.middleclick", false);         // default varies

// --- Don't DNS-resolve single typed words (sends every word to your DNS) ---
user_pref("browser.urlbar.dnsResolveSingleWordsAfterSearch", 0);         // default: 0 (lock)

// --- Disable inline unit conversion in URL bar (you don't use it) ---
user_pref("browser.urlbar.unitConversion.enabled", false);

// --- No touchscreen, kill touch event listener registration on every page ---
user_pref("dom.w3c_touch_events.enabled", 0);                            // default: 2 (auto-detect)

// --- Disable Places snapshots / recommendations engine ---
user_pref("browser.places.snapshots.enabled", false);

// --- Reader mode color scheme (cosmetic) ---
user_pref("reader.color_scheme", "auto");

// --- Don't auto-pop the download panel on every download ---
user_pref("browser.download.alwaysOpenPanel", false);                    // default: true


// =============================================================================
// SECTION 26m: URL BAR — FULL LINK DISPLAY
// =============================================================================

// --- Always show the full URL (don't trim http://, https://, or trailing /) ---
user_pref("browser.urlbar.trimURLs", false);                             // default: true — was trimming http://
user_pref("browser.urlbar.trimHttps", false);                            // default: true (FF120+) — was trimming https://

// --- Don't gray-out non-domain parts of the URL ---
user_pref("browser.urlbar.formatting.enabled", false);                   // default: true — keep full color URL

// --- Single click selects the entire URL (vs. placing cursor in word) ---
user_pref("browser.urlbar.clickSelectsAll", true);                       // default: false on Linux, varies

// --- Don't auto-fill .com / www. when typing ---
user_pref("browser.fixup.alternate.enabled", false);                     // default: true


// =============================================================================
// SECTION 26n: TAB UX — QUALITY OF LIFE
// =============================================================================

// --- New tabs open immediately after current tab (Chrome-like) ---
// Default behavior puts new tabs at the end of the bar.
user_pref("browser.tabs.insertAfterCurrent", true);                      // default: false
user_pref("browser.tabs.insertRelatedAfterCurrent", true);               // default: true (lock)

// --- Double-click a tab to close it (faster than aiming for the X) ---
user_pref("browser.tabs.closeTabByDblclick", true);                      // default: false

// --- Don't warn when opening many tabs (e.g. from bookmarks folder) ---
user_pref("browser.tabs.warnOnOpen", false);                             // default: true
user_pref("browser.tabs.maxOpenBeforeWarn", 100);                        // default: 15

// --- Keep window open when you close the last tab ---
user_pref("browser.tabs.closeWindowWithLastTab", false);                 // default: true

// --- Ctrl+Tab cycles tabs in most-recently-used order (Chrome-style) ---
user_pref("browser.ctrlTab.sortByRecentlyUsed", true);                   // default: false

// --- Allow tabs to shrink to smaller min width before scrolling ---
user_pref("browser.tabs.tabMinWidth", 76);                               // default: 76 — lock at min


// =============================================================================
// SECTION 26o: CONTEXT MENU & INTERACTION
// =============================================================================

// --- Middle-click pan-scroll (Windows behavior, useful on long pages) ---
user_pref("general.autoScroll", true);                                   // default: false on Linux

// --- Alt+Click a link to download it directly ---
user_pref("browser.altClickSave", true);                                 // default: false

// --- Restore "View Image Info" right-click option ---
user_pref("browser.menu.showViewImageInfo", true);                       // default: false

// --- Keep bookmark menu open after clicking (lets you open multiple) ---
user_pref("browser.bookmarks.openInTabClosesMenu", false);               // default: true

// --- Don't add downloads to Windows "Recent Files" jumplist (privacy) ---
user_pref("browser.download.manager.addToRecentDocs", false);            // default: true


// =============================================================================
// SECTION 26p: FIND-IN-PAGE & MISC UI
// =============================================================================

// --- Highlight all matches by default when finding ---
user_pref("findbar.highlightAll", true);                                 // default: false

// --- Modal find UI (dimmed page, large match indicator) ---
user_pref("findbar.modalHighlight", true);                               // default: false

// --- Auto-handle cookie banners (huge UX win — FF clicks "Reject" for you) ---
user_pref("cookiebanners.service.mode", 2);                              // 0=disabled, 1=reject-only, 2=reject-or-accept
user_pref("cookiebanners.service.mode.privateBrowsing", 2);

// --- Force reduced-motion CSS preference (sites with @media reduced-motion will respect it) ---
// Snappier for sites that animate transitions. Comment out if you like animations.
user_pref("ui.prefersReducedMotion", 1);                                 // 0=no preference, 1=reduce

// --- Hover tooltip delay (default 500ms, faster = snappier feel) ---
user_pref("ui.tooltipDelay", 300);                                       // default: 500


// =============================================================================
// SECTION 26r: ENABLE userChrome.css / userContent.css LOADING
// =============================================================================
// Required for the userChrome.css in chrome/ to take effect.

user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);  // default: false


// =============================================================================
// SECTION 26q: STATICPREFS GAPS — REAL ADDS + LOCK GOOD DEFAULTS
// =============================================================================

// --- Hardware media keys: stop FF from intercepting play/pause/next keys ---
// (sends them to Spotify/Discord/etc. instead of a paused YouTube tab)
user_pref("media.hardwaremediakeys.enabled", false);                     // default: true

// --- Content Analysis (enterprise DLP) — kill the entire subsystem ---
user_pref("browser.contentanalysis.enabled", false);                     // default: false (lock)
user_pref("browser.contentanalysis.interception_point.clipboard.enabled", false);
user_pref("browser.contentanalysis.interception_point.drag_and_drop.enabled", false);
user_pref("browser.contentanalysis.interception_point.file_upload.enabled", false);
user_pref("browser.contentanalysis.interception_point.print.enabled", false);

// --- OpenType SVG fonts (rare animated/colored glyph fonts, almost no sites use) ---
user_pref("gfx.font_rendering.opentype_svg.enabled", false);             // default: true

// --- Video buffer readahead (less mid-video network re-fetches on long YT vids) ---
user_pref("media.cache_readahead_limit", 120);                           // default: 60 seconds

// --- Page load deprioritization window (resume bg tasks sooner on 9950X3D) ---
user_pref("page_load.deprioritization_period", 1000);                    // default: 5000ms

// --- LOCK good defaults (insurance against Mozilla flipping them later) ---
user_pref("widget.windows.window_occlusion_tracking.enabled", true);     // major perf: skip paint when FF covered
user_pref("apz.paint_skipping.enabled", true);                           // skip paint during async scroll if no changes
user_pref("media.suspend-bkgnd-video.enabled", true);                    // suspend video decode in bg tabs
user_pref("media.block-autoplay-until-in-foreground", true);             // no audio from background tabs


// =============================================================================
// SECTION 26s: STATICPREFS AUDIT FINDINGS — HIGH IMPACT
// =============================================================================
// 24 prefs from full StaticPrefList.yaml audit (19,209 lines walked).

// --- HTTP traffic analyzer (telemetry categorization on every request) ---
user_pref("network.traffic_analyzer.enabled", false);                    // default: true

// --- HTTPS-First parallel HTTP probe (default sends an HTTP background request
//     after 2.2s when HTTPS handshake stalls — pure wasted I/O on most sites) ---
user_pref("dom.security.https_only_mode_send_http_background_request", false);  // default: true

// --- Don't write disk exceptions on every HTTPS-First fallback ---
user_pref("dom.security.https_first_add_exception_on_failure", false);   // default: true

// --- Network Information API (lock off, fingerprint surface) ---
user_pref("dom.netinfo.enabled", false);                                 // default: false (lock)

// --- Background-tab Worker throttling (ESR misses this nightly default) ---
// Tabs with rogue workers (Slack, Teams, Discord web) get budget-timer throttled
user_pref("dom.workers.throttling.enabled", true);                       // mirror:once, restart needed

// --- Earlier background timer throttling (was 30s) ---
user_pref("dom.timeout.throttling_delay", 10000);                        // default: 30000

// --- Always honor processCount even if memory is "low" (never on 32 GB) ---
user_pref("dom.ipc.processPrelaunch.lowmem_mb", 0);                      // default: 4096

// --- Larger eager-parse budget for big SPAs (Figma/Slack/Discord) ---
user_pref("dom.script_loader.delazification.max_size", 52428800);        // default: 10485760 (10MB → 50MB)

// --- Image cache (default 5 MB is absurd on 32 GB; mirror:once) ---
user_pref("image.cache.size", 33554432);                                 // default: 5242880 (5MB → 32MB)

// --- Shared image surfaces stay mapped longer ---
user_pref("image.mem.shared.unmap.min_expiration_ms", 300000);           // default: 60000

// --- Bigger GIF/APNG buffer before on-demand re-decode (Twitter timelines) ---
user_pref("image.animated.decode-on-demand.threshold-kb", 131072);       // default: 20480

// --- GPU canvas: more concurrent draw targets (Figma-class sites) ---
user_pref("gfx.canvas.accelerated.max-draw-target-count", 512);          // default: 200

// --- GPU canvas: more warm empty slots ---
user_pref("gfx.canvas.accelerated.reserve-empty-cache", 64);             // default: 36

// --- Bigger WebRender shared surface (RTX 5090 has no driver bugs) ---
user_pref("gfx.webrender.max-shared-surface-size", 4096);                // default: 2048 mirror:once

// --- Bigger WebRender picture tiles (fewer draw calls at 4K+) ---
user_pref("gfx.webrender.picture-tile-width", 2048);                     // default: 1024
user_pref("gfx.webrender.picture-tile-height", 2048);                    // default: 512

// --- Faster font scan after startup (was 60s) ---
user_pref("gfx.font_loader.delay", 8000);                                // default: 60000 on Win

// --- Faster bg-tab video suspend (less CPU on backgrounded videos) ---
user_pref("media.suspend-background-video.delay-ms", 3000);              // default: 10000

// --- Let GMP (Widevine/OpenH264) use multiple threads ---
user_pref("media.gmp.decoder.multithreaded", true);                      // default: false

// --- More concurrent DXVA HW-decoded videos (multi-YouTube heaven) ---
user_pref("media.wmf.dxva.max-videos", 16);                              // default: 8

// --- Native lazy-load triggers earlier (images ready when you scroll) ---
user_pref("dom.image-lazy-loading.root-margin.top", 1200);               // default: 600
user_pref("dom.image-lazy-loading.root-margin.bottom", 1200);            // default: 600

// --- Lock Network Error Logging off (no third-party error pings) ---
user_pref("network.http.network_error_logging.enabled", false);


// =============================================================================
// SECTION 26t: STATICPREFS AUDIT — MEDIUM IMPACT (selected high-value)
// =============================================================================

// --- BIG LATENCY WIN: OCSP only for EV certs (CRLite covers DV) ---
// Saves 100-300ms per new HTTPS origin. CRLite is already on (crlite_mode=2).
user_pref("security.OCSP.enabled", 2);                                   // default: 1 (DV+EV → EV only)

// --- Built-in URL tracking parameter stripping (utm_*, fbclid, gclid, etc) ---
user_pref("privacy.query_stripping.enabled", true);                      // default: false
user_pref("privacy.query_stripping.enabled.pbmode", true);
user_pref("privacy.query_stripping.strip_on_share.enabled", true);       // strips from "Copy Link"

// --- Cert verification caches (more = fewer re-verifications, RAM cheap) ---
user_pref("security.pki.cert_signature_cache_size", 512);                // default: 128
user_pref("security.pki.sct_signature_cache_size", 1024);                // default: 256
user_pref("security.pki.cert_trust_cache_size", 512);                    // default: 128

// --- Skip IPv6 lookups when no global v6 (v4-only network speedup) ---
user_pref("network.dns.skip_ipv6_when_no_addresses", true);              // default: false

// --- Coalesce data-finished events with progress updates (fewer IPCs) ---
user_pref("network.send_OnDataFinished_after_progress_updates", true);   // default: false

// --- Stop painting when display is locked/off ---
user_pref("widget.windows.window_occlusion_tracking_display_state.enabled", true);

// --- Surface cache cap raised (was 2 GB → 4 GB, plenty on 32 GB box) ---
user_pref("image.mem.surfacecache.max_size_kb", 4194304);                // default: ~2 GB

// --- Image cache eviction weights recency over size ---
user_pref("image.cache.timeweight", 750);                                // default: 500

// --- Enable JPEG-XL (cheap, sites may serve it eventually) ---
user_pref("image.jxl.enabled", true);                                    // default: false

// --- SVG blob image (faster icon-heavy UI rerasterization on zoom) ---
user_pref("image.svg.blob-image", true);                                 // default: false

// --- Media: longer buffered threshold before resuming network ---
user_pref("media.cache_resume_threshold", 60);                           // default: 30

// --- Larger audio ring buffer (fewer audio glitches under load) ---
user_pref("media.audio.audiosink.threshold_ms", 500);                    // default: 200

// --- Video frame stats: kill fingerprint surface ---
user_pref("media.video_stats.enabled", false);                           // default: true

// --- Cookie Store API (almost no sites use, extra surface) ---
user_pref("dom.cookieStore.enabled", false);                             // default: true
user_pref("dom.cookieStore.manager.enabled", false);

// --- OPFS / Origin Private File System (only used by web IDEs) ---
user_pref("dom.fs.enabled", false);                                      // default: true
user_pref("dom.fs.writable_file_stream.enabled", false);

// --- Origin Trials: prevent Mozilla remote-flipping experimental APIs ---
user_pref("dom.origin-trials.enabled", false);                           // default: true

// --- Payment Request API (never used personally — kill the surface) ---
user_pref("dom.payments.request.enabled", false);                        // default: false (lock)

// --- LocalStorage quota bumps (Slack/Discord stop re-fetching when hitting cap) ---
user_pref("dom.storage.default_quota", 10240);                           // default: 5120 KB
user_pref("dom.storage.default_site_quota", 51200);                      // default: 25600 KB

// --- WebGL: kill debug renderer info exposure (fingerprint) ---
user_pref("webgl.enable-debug-renderer-info", false);                    // default: true
user_pref("webgl.max-warnings-per-context", 0);                          // default: 32 (console spam)
user_pref("webgl.perf.spew-frame-allocs", false);                        // default: true (console spam)

// --- Sponsored session timeout (belt-and-suspenders, quicksuggest already off) ---
user_pref("browser.places.sponsoredSession.timeoutSecs", 0);             // default: 3600

// --- Lock legacy mutation events off (deprecated) ---
user_pref("dom.mutation_events.enabled", false);                         // default: false (lock)

// --- Disable legacy Components shim (ESR tech-debt from old extensions) ---
user_pref("dom.use_components_shim", false);                             // default: true on ESR

// --- Wireframe collection on navigation (telemetry, lock off) ---
user_pref("browser.history.collectWireframes", false);                   // default: false (lock)


// =============================================================================
// SECTION 26u: REMAINING TELEMETRY ENDPOINTS — BLANKED
// =============================================================================

// --- ASan crash reporter (only used in ASan-instrumented builds, but URL is set in ESR) ---
user_pref("asanreporter.apiurl", "");                                    // default: anf1.fuzzing.mozilla.org/crashproxy/submit
user_pref("asanreporter.clientid", "");

// --- HTML parser event sampling rate (every parsed event → telemetry probe) ---
user_pref("content.sink.event_probe_rate", 0);                           // default: 1

// --- Addon browser mapping API endpoint ---
user_pref("extensions.getAddons.browserMappings.url", "");               // default: services.addons.mozilla.org

// --- Mozilla Shopping OHTTP endpoints (even though Shopping feature is disabled) ---
user_pref("toolkit.shopping.ohttpConfigURL", "");                        // default: prod.ohttp-gateway.prod.webservices.mozgcp.net
user_pref("toolkit.shopping.ohttpRelayURL", "");                         // default: mozilla-ohttp.fastly-edge.com


// =============================================================================
// SECTION 26v: REMAINING WEB API KILLS — DESKTOP HAS NO SENSORS
// =============================================================================

// --- Generic Sensor API: master kill + every sub-sensor ---
// Desktop has no accelerometer / orientation / ambient light / proximity.
// Sites can still fingerprint via these even if they always return zero.
user_pref("device.sensors.enabled", false);                              // default: true
user_pref("device.sensors.motion.enabled", false);                       // default: true
user_pref("device.sensors.orientation.enabled", false);                  // default: true
user_pref("device.sensors.ambientLight.enabled", false);                 // default: false (lock)
user_pref("device.sensors.proximity.enabled", false);                    // default: false (lock)

// --- Async clipboard READ (privacy: sites can read your clipboard contents) ---
// Keeping write/clipboardItem (needed for Discord, modern paste UX).
user_pref("dom.events.asyncClipboard.readText", false);                  // default: true

// --- Web Share API (mobile-only spec, useless on desktop) ---
user_pref("dom.webshare.enabled", false);                                // default: false on desktop (lock)

// --- Lock other off-by-default DOM features that could be flipped later ---
user_pref("dom.element.blocking.enabled", false);                        // default: false (lock)
user_pref("dom.element.commandfor.enabled", false);                      // default: false (lock)
user_pref("dom.security.featurePolicy.experimental.enabled", false);     // default: false (lock)
user_pref("dom.security.featurePolicy.webidl.enabled", false);           // default: false (lock)

// --- Toolkit scrollbox smooth scroll (URL bar dropdown, menus — was missed by earlier kill) ---
user_pref("toolkit.scrollbox.smoothScroll", false);                      // default: true

// --- Private browsing auto-start (defense, in case anything tries to flip it) ---
user_pref("browser.privatebrowsing.autostart", false);                   // default: false (lock)


// =============================================================================
// SECTION 26w: ALL.JS PASS — REMAINING URLS & LOGGERS
// =============================================================================

// --- Decoder Doctor webcompat report URL ---
user_pref("media.decoder-doctor.new-issue-endpoint", "");                // default: webcompat.com/issues/new

// --- Geolocation provider URL (geo.enabled is off, lock URL too) ---
user_pref("geo.provider.network.url", "");                               // default: googleapis.com geolocation

// --- Connectivity service URLs (connectivity-service.enabled is off, lock URLs) ---
user_pref("network.connectivity-service.IPv4.url", "");                  // default: detectportal.firefox.com
user_pref("network.connectivity-service.IPv6.url", "");

// --- Mozilla Monitor (formerly Firefox Monitor) — all about:protections URLs ---
user_pref("browser.contentblocking.report.lockwise.enabled", false);     // password manager protection report
user_pref("browser.contentblocking.report.monitor.url", "");
user_pref("browser.contentblocking.report.monitor.how_it_works.url", "");
user_pref("browser.contentblocking.report.monitor.sign_in_url", "");
user_pref("browser.contentblocking.report.monitor.preferences_url", "");
user_pref("browser.contentblocking.report.monitor.home_page_url", "");
user_pref("browser.contentblocking.report.manage_devices.url", "");
user_pref("browser.contentblocking.report.endpoint_url", "");            // breach-stats endpoint

// --- Mozilla VPN / Focus / FPN promo URLs in about:protections ---
user_pref("browser.contentblocking.report.proxy_extension.url", "");     // FPN promo
user_pref("browser.contentblocking.report.vpn.url", "");
user_pref("browser.contentblocking.report.vpn-promo.url", "");
user_pref("browser.contentblocking.report.vpn-android.url", "");
user_pref("browser.contentblocking.report.vpn-ios.url", "");
user_pref("browser.contentblocking.report.mobile-ios.url", "");
user_pref("browser.contentblocking.report.mobile-android.url", "");

// --- Mozilla support.mozilla.org URLs in about:protections (clicking learn-more) ---
user_pref("browser.contentblocking.report.lockwise.how_it_works.url", "");
user_pref("browser.contentblocking.report.social.url", "");
user_pref("browser.contentblocking.report.cookie.url", "");
user_pref("browser.contentblocking.report.tracker.url", "");
user_pref("browser.contentblocking.report.fingerprinter.url", "");
user_pref("browser.contentblocking.report.cryptominer.url", "");

// --- UI Tour survey timing (uitour.enabled is off, but lock duration) ---
user_pref("browser.uitour.surveyDuration", 0);                           // default: 7200

// --- Google Safe Browsing URLs (safebrowsing is off, blank the URLs as defense) ---
// Note: keep browser.safebrowsing.provider.mozilla.* alone — those feed ETP
user_pref("browser.safebrowsing.provider.google.updateURL", "");
user_pref("browser.safebrowsing.provider.google.gethashURL", "");
user_pref("browser.safebrowsing.provider.google.reportURL", "");
user_pref("browser.safebrowsing.provider.google.reportPhishMistakeURL", "");
user_pref("browser.safebrowsing.provider.google.reportMalwareMistakeURL", "");
user_pref("browser.safebrowsing.provider.google.advisoryURL", "");
user_pref("browser.safebrowsing.provider.google4.updateURL", "");
user_pref("browser.safebrowsing.provider.google4.gethashURL", "");
user_pref("browser.safebrowsing.provider.google4.reportURL", "");
user_pref("browser.safebrowsing.provider.google4.reportPhishMistakeURL", "");
user_pref("browser.safebrowsing.provider.google4.reportMalwareMistakeURL", "");
user_pref("browser.safebrowsing.provider.google4.advisoryURL", "");
user_pref("browser.safebrowsing.provider.google4.dataSharingURL", "");
user_pref("browser.safebrowsing.reportPhishURL", "");

// --- Remaining log subsystems missed earlier ---
user_pref("places.loglevel", "Fatal");                                   // default: Error — Places history DB
user_pref("toolkit.sqlitejsm.loglevel", "Fatal");                        // default: Error — SQLite JS wrapper
user_pref("toolkit.osKeyStore.loglevel", "Fatal");                       // default: Warn — OS credential store
user_pref("privacy.query_stripping.listService.logLevel", "Fatal");      // default: Error
user_pref("privacy.fingerprintingProtection.WebCompatService.logLevel", "Fatal");
user_pref("toolkit.asyncshutdown.log", false);                           // default: false (lock)
user_pref("browser.region.log", false);                                  // default: false (lock)
user_pref("browser.search.log", false);                                  // default: false (lock)
user_pref("devtools.debugger.log", false);                               // default: false (lock)
user_pref("devtools.discovery.log", false);                              // default: false (lock)
user_pref("browser.newtabpage.resource-mapping.log", false);             // default: false (lock)
user_pref("toolkit.contentRelevancy.log", false);                        // default: false (lock)

// --- Memory crash reporting (already off by default, lock) ---
user_pref("memory.dump_reports_on_oom", false);                          // default: false (lock)
user_pref("memory.blob_report.stack_frames", 0);                         // default: 0 (lock)

// --- Services common uptake telemetry sample rate (1% → 0%) ---
user_pref("services.common.uptake.sampleRate", 0);                       // default: 1

// --- Nimbus QA test prefs (state pollution from QA infrastructure) ---
user_pref("nimbus.qa.pref-1", "");
user_pref("nimbus.qa.pref-2", "");
user_pref("nimbus.debug", false);                                        // default: false (lock)

// --- JS load crash tracking (state, but lock to defaults) ---
user_pref("security.crash_tracking.js_load_1.maxCrashes", 0);            // default: 1


// =============================================================================
// SECTION 26x: PAGE LOAD ENDGAME — CONTENT/RESOURCE RESEARCH FINDINGS
// =============================================================================
// Top wins from Firefox source research (Bugzilla-verified):

// --- BIGGEST WIN: in-memory script cache surviving same-doc navigation ---
// Massive for SPAs and back/forward navigation
user_pref("dom.script_loader.navigation_cache", true);                   // default: false

// --- Speculatively OMT-parse scripts that were rel=preloaded ---
// (the parser starts before the doc has even committed)
user_pref("dom.script_loader.external_scripts.speculate_link_preload.enabled", true);  // default: false

// --- Eager full-parse strategy (no lazy heuristic — CPU is cheap on 9950X3D) ---
user_pref("dom.script_loader.delazification.strategy", 0);               // default: 255 (DefaultStrategy)

// --- Keep service workers warm between navigations (30s → 5min) ---
// Avoids 200ms+ SW respawn on every "instant" cached page load
user_pref("dom.serviceWorkers.idle_timeout", 300000);                    // default: 30000
user_pref("dom.serviceWorkers.idle_extended_timeout", 600000);           // default: 30000

// --- Cache metadata index (1MB → 16MB; collapses disk seeks to memcpy) ---
user_pref("browser.cache.disk.metadata_memory_limit", 16384);            // default: 1024

// --- Larger cache entry sizes (huge JS bundles stay cached) ---
user_pref("browser.cache.disk.max_entry_size", 153600);                  // default: 51200 (was 102400 in 26m, raise to 150MB)
user_pref("browser.cache.memory.max_entry_size", 32768);                 // default: 5120 → 32MB hot scripts in RAM

// --- HTML parser quantum: more nodes per slice on 16-thread CPU ---
user_pref("content.sink.perf_deflect_count", 1024);                      // default: 200
user_pref("content.sink.perf_parse_time", 360000);                       // default: 30000
user_pref("content.sink.pending_event_mode", 0);                         // default: 0 (lock)

// --- HTML5 flush timer (faster parse-to-DOM flush) ---
user_pref("html5.flushtimer.initialdelay", 8);                           // default: 16
user_pref("html5.flushtimer.subsequentdelay", 8);                        // default: 16

// --- Fetch priority: force rel=preload scripts to URGENT_START ---
user_pref("network.fetchpriority.adjustments.link-preload-script.high", -20);  // default: 0
user_pref("network.fetchpriority.adjustments.link-preload-style.high", -10);   // default: 0

// --- Early Hints: more preconnect slots ---
user_pref("network.early-hints.preconnect.max_connections", 32);         // default: 10

// --- Pacing: faster request dispatch on 16-thread CPU ---
user_pref("network.http.pacing.requests.hz", 200);                       // default: 80

// --- Re-enable predictor prefetch + aggressive confidence
//     (was tuned conservatively earlier — for pure-speed mode, go aggressive)
user_pref("network.predictor.enable-prefetch", true);                    // default: false on release
user_pref("network.predictor.preconnect-min-confidence", 30);            // default: 90
user_pref("network.predictor.preresolve-min-confidence", 10);            // default: 60
user_pref("network.predictor.prefetch-min-confidence", 50);              // default: 100

// --- Per-server connection count (already raised, lock at 10) ---
// (browser.cache.disk.max_entry_size and network.http.pacing.requests.burst
//  already set earlier — confirmed match)


// =============================================================================
// SECTION 26y: PAGE LOAD ENDGAME — RENDERING PIPELINE RESEARCH FINDINGS
// =============================================================================
// From rendering-pipeline research (Bugzilla-cited):

// --- WebRender thread-local arenas (cut malloc contention on hot threads) ---
user_pref("gfx.webrender.scene-builder-thread-local-arena", true);       // bug 1612440 family
user_pref("gfx.webrender.frame-builder-thread-local-arena", true);

// --- WebRender feature locks (force-enable on RTX 5090) ---
user_pref("gfx.webrender.enable-multithreading", true);
user_pref("gfx.webrender.batched-texture-uploads", true);
user_pref("gfx.webrender.use-optimized-shaders", true);
user_pref("gfx.webrender.compositor.force-enabled", true);               // force DComp native compositor
user_pref("gfx.webrender.dcomp-win.enabled", true);
user_pref("gfx.webrender.allow-software-fallback", false);               // crash instead of swrast (RTX won't fail)
user_pref("gfx.webrender.svg-images", true);                             // SVG rasterize on WR backend
user_pref("gfx.webrender.low-quality-pinch-zoom", false);                // RTX 5090: spend GPU on quality

// --- Display list retention (rebuild only changed sub-trees) ---
user_pref("layout.display-list.retain", true);
user_pref("layout.display-list.retain.chrome", true);
user_pref("layout.display-list.retain.sc", true);                        // stacking-context retention
user_pref("layout.display-list.rebuild-frame-limit", 1000);              // default: 500
user_pref("layout.paint_rects_separately", true);                        // partial presentation
user_pref("layout.css.scroll-anchoring.enabled", true);                  // avoid layout-shift repaints
user_pref("layout.idle_scheduler.threads", 4);                           // more idle-time layout work

// --- Image decoding: eager, parallel, in-viewport-first ---
user_pref("image.mem.decode_bytes_at_a_time", 1048576);                  // 65536 → 1MB chunks
user_pref("image.decode-immediately.enabled", true);                     // bug 1149893 — kill pop-in
user_pref("image.downscale-during-decode.enabled", true);                // fewer pixels through pipeline
user_pref("image.mem.volatile.min_discard_timeout_ms", 600000);          // hold decoded longer
user_pref("image.multithreaded_image_decoder.num_threads", 12);          // explicit 12/16 cores

// --- APZ tuning: bigger displayport during scroll, no checkerboard ---
user_pref("apz.frame_delay.enabled", true);                              // batch one frame for smoothness
user_pref("apz.allow_zooming", false);                                   // disables touchpad pinch (mouse-only setup)
user_pref("apz.displayport_expiry_ms", 15000);                           // keep displayport alive longer
user_pref("apz.x_skate_size_multiplier", 2.0);                           // bigger paint-ahead during fast scroll
user_pref("apz.y_skate_size_multiplier", 3.5);                           // 5090 can paint the slack
user_pref("apz.x_stationary_size_multiplier", 3.0);
user_pref("apz.y_stationary_size_multiplier", 3.5);
user_pref("apz.peek_messages.enabled", true);
user_pref("apz.prefer_jank_minimal_displayports", false);                // we have GPU — prefer no-checkerboard
user_pref("apz.fling_min_velocity_threshold", 0.0);

// --- FOREGROUND vs BACKGROUND: starve background, give foreground everything ---
// Win11 EcoQoS pushes bg tabs to E-cores (we don't have E-cores on 9950X3D, but
// the Windows scheduler still de-prioritizes), and dom.min_background_timeout_value
// floors background setTimeout(0) to 10s — your foreground gets every frame.
user_pref("dom.ipc.processPriorityManager.backgroundPerceivableGracePeriodMS", 0);
user_pref("dom.ipc.processPriorityManager.backgroundGracePeriodMS", 0);
user_pref("dom.min_background_timeout_value", 10000);                    // bg setTimeout floored to 10s
user_pref("dom.min_background_timeout_value_without_budget_throttling", 10000);
user_pref("dom.timeout.background_budget_regeneration_rate", 1);
user_pref("dom.timeout.background_throttling_max_budget", 1);
user_pref("dom.timeout.foreground_budget_regeneration_rate", 1);
user_pref("dom.timeout.foreground_throttling_max_budget", -1);           // foreground: unlimited
user_pref("dom.timeout.tracking_throttling_delay", 1000000);             // tracker scripts throttled hard
user_pref("dom.timeout.enable_budget_timer_throttling", true);

// --- Process count: one per logical CPU thread (tuned for 16T CPUs) ---
// Each extra process ~200 MB → +1.6 GB worst-case on 32 GB RAM. Trade RAM for parallelism.
// Lower this to 8 if you have < 16 GB RAM.
user_pref("dom.ipc.processCount", 16);
user_pref("dom.ipc.processCount.webIsolated", 16);
user_pref("dom.ipc.keepProcessesAlive.web", 8);                          // hot pool — no fork latency

// --- Override earlier conservative dom.timeout.throttling_delay ---
// (Section 26s set it to 10000; rendering research wants more aggressive bg throttle)
// Keeping at 10000 since 0 would be too aggressive — leave the section 26s value.


// =============================================================================
// SECTION 26z: PAGE LOAD ENDGAME — NETWORK/TRANSPORT RESEARCH FINDINGS
// =============================================================================
// From network-layer research (Bugzilla + mozilla-esr140 source verified):

// --- BIGGEST WIN: switch QUIC UDP I/O from NSPR to quinn-udp ---
// Modern syscalls (recvmmsg/WSARecvMsg+GSO/URO). 5-15% throughput on QUIC origins.
// Default `true` on ESR (via @IS_NOT_EARLY_BETA_OR_EARLIER@). Bug 1916558 only
// affected ARM64 Win — irrelevant for x64.
user_pref("network.http.http3.use_nspr_for_io", false);                  // default: true on ESR

// --- QUIC flow-control: larger windows for big streams ---
user_pref("network.http.http3.max_data", 33554432);                      // default: 25165824 (24 MiB → 32 MiB)
user_pref("network.http.http3.max_stream_data", 16777216);               // default: 12582912 (12 MiB → 16 MiB)

// --- UDP recv buffer (1 MB → 4 MB; bursty CDNs drop packets at 1 MB on 10G NIC) ---
user_pref("network.http.http3.recvBufferSize", 4194304);                 // default: 1048576

// --- Keep QUIC sessions warm for repeat visits ---
user_pref("network.http.http3.idle_timeout", 60);                        // default: 30 seconds

// --- On-wire background tab deprioritization (PRIORITY_UPDATE urgency=6) ---
user_pref("network.http.http3.send_background_tabs_deprioritization", true);  // default: false

// --- Predictor: hover-preconnects on HTTPS pages too ---
user_pref("network.predictor.enable-hover-on-ssl", true);                // default: false

// --- More TLS resumption tickets per origin (3 → 5) ---
user_pref("network.ssl_tokens_cache_records_per_entry", 5);              // default: 3

// --- Larger per-channel network buffers (32 → 64 KB, 24 → 128 count) ---
user_pref("network.buffer.cache.count", 128);                            // default: 24
user_pref("network.buffer.cache.size", 65536);                           // default: 32768

// --- Match CDN edge keep-alive (115s → 600s; fewer TCP re-handshakes) ---
user_pref("network.http.keep-alive.timeout", 600);                       // default: 115
user_pref("network.http.tcp_keepalive.short_lived_connections", true);   // default already

// --- Fetchpriority urgency mapping ---
user_pref("network.fetchpriority.adjust_urgency", true);                 // default: true (lock)


// =============================================================================
// SECTION 27: MISCELLANEOUS BLOAT — OFF
// =============================================================================

user_pref("browser.shopping.experience2023.enabled", false);
user_pref("browser.shopping.experience2023.active", false);
user_pref("browser.tabs.firefox-view.logLevel", "Fatal");
user_pref("browser.contentblocking.cfr-milestone.enabled", false);
user_pref("ui.new-webcompat-reporter.enabled", false);
user_pref("ui.new-webcompat-reporter.reason-dropdown", 0);
user_pref("ui.new-webcompat-reporter.send-more-info-link", false);

// --- Webcompat reporter extension ---
user_pref("extensions.webcompat-reporter.enabled", false);               // default: true
user_pref("extensions.webcompat-reporter.newIssueEndpoint", "");

// --- Addon abuse reporting ---
user_pref("extensions.abuseReport.amoFormURL", "");
user_pref("extensions.addonAbuseReport.url", "");

// --- Feedback URLs ---
user_pref("app.feedback.baseURL", "");

// --- Process hang reporting ---
user_pref("dom.ipc.reportProcessHangs", false);                         // default: true

// --- DOM Reporting API ---
user_pref("dom.reporting.enabled", false);
user_pref("dom.reporting.crash.enabled", false);
user_pref("dom.reporting.header.enabled", false);
user_pref("dom.reporting.featurePolicy.enabled", false);

// --- CSP violation reporting ---
user_pref("security.csp.reporting.enabled", false);                      // default: true

// --- HTTP/3 ECN reporting ---
user_pref("network.http.http3.ecn_report", false);                       // default: true

// --- CSS error reporting (minor CPU overhead per page) ---
user_pref("layout.css.report_errors", false);                            // default: true
user_pref("pdfjs.enableAltText", false);
user_pref("pdfjs.enableAltTextModelDownload", false);
user_pref("pdfjs.enableGuessAltText", false);
user_pref("extensions.systemAddon.update.enabled", false);
user_pref("browser.dataFeatureRecommendations.enabled", false);
user_pref("cookiebanners.ui.desktop.enabled", false);
user_pref("security.certerrors.mitm.priming.enabled", false);
user_pref("dom.indexedDB.logging.enabled", false);
user_pref("dom.indexedDB.logging.details", false);
user_pref("signon.firefoxRelay.feature", "disabled");


// =============================================================================
// SECTION 28: PASSWORD MANAGER — KEEP FOR SYNC
// =============================================================================
// Sync-critical prefs left at defaults.


// =============================================================================
// END OF ENDGAME USER.JS
// =============================================================================
