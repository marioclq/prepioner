# PioneerVFD — Claude edition

Spicetify theme + extension. Windows 11, PowerShell 7, Node v24.15.0, Spicetify 2.45.1. No PHP, no Docker, no git repo here.

## Layout
- `Themes\PioneerVFDClaude\` `user.css` + `color.ini`; `Extensions\pioneerVFDClaude.js` (single file, no build; pure logic exported for tests).
- CSS/DOM prefix `pvc-`. Marker: `document.documentElement.dataset.pvc` = `loaded` | `mounted`.
- Other model's test lives in `..\opencode\` (theme `PioneerVFDLite`). Do not edit it. `install.ps1` disables its extension; `uninstall.ps1` restores it.

## Commands
- Tests: `node --test tests\logic.test.js` (12 must pass).
- Sizes and costly-rule counts: `.\scripts\measure.ps1`.
- Install / restore: `.\scripts\install.ps1 [-DebugPort]`, `.\scripts\uninstall.ps1`. Both **restart Spotify** (cuts the user's music): warn first.
- Dev loop: `.\scripts\dev-sync.ps1` (needs `-DebugPort` install). Inspect: `node scripts\cdp.js eval|shot|perf|logs|reset`. Crop: `scripts\crop.ps1`.

## Rules learned the hard way (verified)
- `spicetify config extensions X` appends, `X-` removes. `spotify_launch_flags` must be written in `config-xpui.ini`.
- Never `Page.reload` over CDP; never `shot` with `clip` (hangs). A minimized Spotify window invalidates screenshots and perf: ask the user to restore it.
- `getProgress()` throws while Spotify boots; wait for it.
- Do not run buttons that change the user's music/library (next, like, queue) without telling them.
- Budget: CSS <= 40 KB, JS <= 30 KB, no `blur`/`backdrop-filter`, continuous animation only on `opacity`/`transform`.
- Errors fail loudly with input data; no silent fallbacks (`NO DATA`, `--:--` are visible states, not hidden ones).
- Close the debug port when done: `.\scripts\install.ps1` without `-DebugPort`.
- No commits unless asked. Palette is from PioneerVFD (MIT, William Starks): keep `LICENSE-NOTICE.md`.
