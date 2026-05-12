# Firefox ENDGAME

Fast Firefox. Source-verified config.

740+ prefs cross-checked against [mozilla/gecko-dev](https://github.com/mozilla/gecko-dev). Telemetry, ads, AI, experiments killed. Network + render pipeline tuned. UI animations off. Tested on Firefox 140 ESR.

## Install

Download [`install.bat`](../../releases/latest/download/install.bat), double-click. Firefox must be closed.

```
user.js          → <profile>/
userChrome.css   → <profile>/chrome/
userContent.css  → <profile>/chrome/
```

Existing `user.js` is backed up with a timestamp.

## Rollback

Delete the new files. Rename the `.backup-*` file back to `user.js`. Restart Firefox.

## Preserved

Sync · Translations · Widevine DRM · Spellcheck · WebRTC · WebGL · WebGPU

## Not set

`privacy.resistFingerprinting` · `privacy.firstparty.isolate` · strict cookie behavior — these break sites (Cloudflare, Sync, OAuth). This is a speed-and-debloat config, not Tor.

## Hardware

Tuned for 16+ thread CPU, 16+ GB RAM, NVMe. Works on less — lower `dom.ipc.processCount` if you have under 16 GB.

## License

MIT
