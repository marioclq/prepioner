# PioneerVFD Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un tema de Spicetify con el aspecto del PioneerVFD original (chasis cromado, LCD negro azulado, fósforo cian, carátula con perilla, rueda, botones, espectro) pero con ~5 % del peso y sin vídeos.

**Architecture:** Tres artefactos sin build: `user.css` (aspecto global y carátula), `color.ini` (paleta de Spicetify) y `pioneerVFDLite.js` (una extensión de un solo archivo que monta la carátula en `.Root__now-playing-bar`). La lógica pura (formato de reloj, validación de progreso, espectro) va dentro de la misma extensión pero se exporta con `module.exports` para probarla con `node:test` sin dependencias.

**Tech Stack:** CSS, JavaScript (ES2022, sin bundler), Spicetify 2.45.1, Node v24.15.0 (`node:test`, `WebSocket` y `fetch` globales), PowerShell 7.

**Spec:** `docs/superpowers/specs/2026-10-26-pioneer-vfd-lite-design.md`

## Global Constraints

- Idioma: respuestas y documentos en español; código, identificadores y mensajes de commit en inglés.
- Entorno: Windows 11, PowerShell 7. Rutas con `\`. Sin `/tmp`, `head`, `tail`, `which`.
- Directorio del proyecto: `C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite\` (en adelante `<proj>`).
- Spicetify: `C:\Users\Mario\AppData\Local\spicetify\spicetify.exe` v2.45.1; datos en `C:\Users\Mario\AppData\Roaming\spicetify`. Config actual del usuario: `current_theme = marketplace`, `color_scheme = catppuccin-mocha`, `extensions` vacío, `expose_apis = 1`, `spotify_launch_flags` vacío.
- Presupuesto (objetivos, se miden en la Tarea 8): `user.css` ≤ 40 KB; extensión ≤ 30 KB; sin vídeos; CPU ≤ 3 puntos porcentuales sobre el tema actual.
- Prohibido: `backdrop-filter`, `filter: blur`, `text-shadow` en filas de lista, más de un `<canvas>`, más de 30 fps.
- Errores: fallar explícito con los datos de entrada. Nada de `try/catch` que trague, ni valores de rescate. Los estados "sin datos" se muestran en pantalla (`NO DATA`, `--:--`), no se ocultan.
- Git: `<proj>` y `C:\Users\Mario\Downloads\VFD` **no son repos git**. No hacer `git init`, commit ni push salvo petición explícita. Cada tarea termina en un "Punto de control" (revisar y guardar), no en commit.
- Verificación: no declarar nada "funcionando" sin ejecutar el comando y pegar la salida real. Cambios visibles: comprobarlos en Spotify real por CDP (captura de pantalla), no deducirlos.
- Efectos secundarios a limpiar al terminar: `spotify_launch_flags` vuelto a vacío; sin Spotify lanzado por nosotros con puerto de depuración abierto.
- `spicetify apply` **reinicia Spotify** y corta la música. Avisar al usuario antes de cada `apply`.
- Atribución: el repo original es MIT, © 2026 William Starks. `<proj>\LICENSE-NOTICE.md` lo cita.

## Selectores de Spotify verificados (existen en el CSS del original, 2026-10-26)

`Root__top-container`, `Root__nav-bar`, `Root__main-view`, `Root__right-sidebar`, `Root__globalNav`, `Root__now-playing-bar`, `main-view-container`, `main-trackList-trackListRow`, `main-trackList-trackListHeaderRow`, `main-entityHeader-title`, `main-nowPlayingView-aboutArtist`, `main-yourLibraryX`, `main-card-card`, `main-playButton-PlayButton`, `main-topBar-container`, `[data-testid="now-playing-bar"]`.

**No usar** otros selectores sin comprobarlos en vivo (`document.querySelector(...)` por CDP).

## APIs de Spicetify verificadas (usadas por el original)

`Spicetify.Player`: `togglePlay`, `back`, `next`, `toggleShuffle`, `toggleRepeat`, `toggleHeart`, `getProgress`, `getDuration`, `seek`, `setVolume`, `getVolume`, `isPlaying`, `getRepeat`, `getHeart`, `getShuffle`, `data` (`data.item.name`, `data.item.uri`, `data.item.artists`), `addEventListener("songchange" | "onplaypause", fn)`; `Spicetify.Platform.History`; `Spicetify.getAudioData(uri?)` (documentada en spicetify.app; el original **no** la usa).
**Sin verificar en vivo** (se comprueba en las Tareas 3, 5 y 6): forma exacta de `getAudioData`, valores de `getRepeat()`, ruta `/queue` en `History.push`.

## Estructura de archivos

```
<proj>\
  Themes\PioneerVFDLite\user.css        aspecto global + carátula (Tareas 4, 5)
  Themes\PioneerVFDLite\color.ini       paleta de Spicetify (Tarea 4)
  Extensions\pioneerVFDLite.js          lógica pura (T3) + DOM (T5) + controles (T6) + canvas (T7)
  tests\logic.test.js                   pruebas de la lógica pura (T3)
  scripts\cdp.js                        cliente CDP mínimo: eval / shot / perf (T1)
  scripts\install.ps1                   copia, respalda config y aplica (T2)
  scripts\uninstall.ps1                 restaura config y quita archivos (T2)
  scripts\measure.ps1                   tamaños de archivos (T1)
  LICENSE-NOTICE.md                     atribución MIT (T1)
  README.md                             uso (T8)
```

---

### Task 1: Esqueleto, cliente CDP y línea base

**Files:**
- Create: `<proj>\LICENSE-NOTICE.md`, `<proj>\scripts\measure.ps1`, `<proj>\scripts\cdp.js`
- Create (directorios vacíos): `<proj>\Themes\PioneerVFDLite`, `<proj>\Extensions`, `<proj>\tests`

**Interfaces:**
- Produces: `node scripts\cdp.js eval "<expr>"`, `node scripts\cdp.js shot <file.png>`, `node scripts\cdp.js perf <seconds>`. Todos requieren Spotify con `--remote-debugging-port=9222`.

- [ ] **Step 1: Crear directorios y aviso de licencia**

```powershell
$p = "C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite"
New-Item -ItemType Directory -Force "$p\Themes\PioneerVFDLite", "$p\Extensions", "$p\tests", "$p\scripts" | Out-Null
```

`<proj>\LICENSE-NOTICE.md`:

```markdown
# Notice

PioneerVFD Lite is an independent, much smaller re-implementation inspired by
PioneerVFD (https://github.com/adainstarks/PioneerVFD), MIT License,
Copyright (c) 2026 William Starks. The colour palette in `color.ini` is taken from that project's
`Themes/PioneerVFD/color.ini`. Unofficial; not affiliated with Pioneer.
```

- [ ] **Step 2: Escribir `scripts\measure.ps1`**

```powershell
param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$files = @(
    "Themes\PioneerVFDLite\user.css",
    "Themes\PioneerVFDLite\color.ini",
    "Extensions\pioneerVFDLite.js"
)
$total = 0
foreach ($f in $files) {
    $path = Join-Path $Root $f
    if (-not (Test-Path $path)) { throw "measure: missing file $path" }
    $len = (Get-Item $path).Length
    $total += $len
    "{0,9} B  {1}" -f $len, $f
}
"{0,9} B  TOTAL" -f $total
"Original (verified 2026-10-26): user.css 736143 B + pioneerVFD.js 566583 B + ~50 MB of .webm"
```

- [ ] **Step 3: Escribir `scripts\cdp.js`**

```javascript
// Minimal Chrome DevTools Protocol client for Spotify (needs --remote-debugging-port=9222).
// Uses Node's global fetch/WebSocket (Node 22+). Usage:
//   node cdp.js eval "<expression>"   node cdp.js shot <file.png>   node cdp.js perf <seconds>
const fs = require("node:fs");
const PORT = 9222;

async function connect() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  if (!res.ok) throw new Error(`CDP target list failed: status=${res.status} body=${await res.text()}`);
  const pages = (await res.json()).filter((t) => t.type === "page");
  if (pages.length !== 1) {
    throw new Error(`Expected exactly 1 page target, got ${pages.length}: ${JSON.stringify(pages.map((p) => [p.title, p.url]))}`);
  }
  const ws = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((ok, fail) => {
    ws.onopen = ok;
    ws.onerror = (e) => fail(new Error(`CDP websocket error: ${e.message}`));
  });
  let nextId = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const w = waiting.get(msg.id);
    if (!w) return;
    waiting.delete(msg.id);
    if (msg.error) w.fail(new Error(`CDP ${w.method} failed: ${JSON.stringify(msg.error)}`));
    else w.ok(msg.result);
  };
  const send = (method, params = {}) =>
    new Promise((ok, fail) => {
      const id = ++nextId;
      waiting.set(id, { ok, fail, method });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { send, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error(`eval failed: expression=${expression} details=${JSON.stringify(r.exceptionDetails)}`);
  }
  return r.result.value;
}

async function metrics(cdp) {
  const { metrics: list } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(list.map((m) => [m.name, m.value]));
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  const cdp = await connect();
  try {
    if (cmd === "eval") {
      if (!arg) throw new Error("usage: cdp.js eval <expression>");
      console.log(JSON.stringify(await evaluate(cdp, arg), null, 2));
    } else if (cmd === "shot") {
      if (!arg) throw new Error("usage: cdp.js shot <file.png>");
      const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
      fs.writeFileSync(arg, Buffer.from(data, "base64"));
      console.log(`saved ${arg}`);
    } else if (cmd === "perf") {
      const seconds = Number(arg);
      if (!(seconds > 0)) throw new Error(`usage: cdp.js perf <seconds>, got ${arg}`);
      await cdp.send("Performance.enable");
      const a = await metrics(cdp);
      await new Promise((r) => setTimeout(r, seconds * 1000));
      const b = await metrics(cdp);
      const per = (k) => ((b[k] - a[k]) / seconds).toFixed(4);
      console.log(JSON.stringify({
        seconds,
        taskCpuPerSec: per("TaskDuration"),
        scriptCpuPerSec: per("ScriptDuration"),
        layoutCpuPerSec: per("LayoutDuration"),
        styleCpuPerSec: per("RecalcStyleDuration"),
        jsHeapUsedMB: (b.JSHeapUsedSize / 1048576).toFixed(1),
        domNodes: b.Nodes,
      }, null, 2));
    } else {
      throw new Error(`unknown command "${cmd}". Use eval | shot | perf`);
    }
  } finally {
    cdp.close();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
```

- [ ] **Step 4: Activar el puerto de depuración (avisar al usuario: Spotify se reinicia)**

```powershell
spicetify config spotify_launch_flags "--remote-debugging-port=9222"
spicetify config spotify_launch_flags
spicetify apply
```

Expected: la segunda orden imprime `--remote-debugging-port=9222`.

- [ ] **Step 5: Comprobar que CDP responde**

```powershell
Invoke-RestMethod http://127.0.0.1:9222/json | Select-Object type, title, url
```

Expected: una fila `type = page`.
Si no responde: cerrar Spotify (`Stop-Process -Name Spotify`), ejecutar `spicetify apply` otra vez y repetir. **Si falla dos veces, parar y decírselo al usuario** (no seguir parcheando).

- [ ] **Step 6: Línea base del tema actual del usuario (marketplace / catppuccin-mocha)**

Pedir al usuario que reproduzca una canción (por ejemplo cualquiera de su lista) y la deje sonando.

```powershell
cd C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite
node scripts\cdp.js eval "document.querySelectorAll('*').length"
node scripts\cdp.js perf 20
node scripts\cdp.js shot "$env:TEMP\pvfdl-baseline.png"
```

Expected: JSON con `taskCpuPerSec`, `scriptCpuPerSec`, etc. **Guardar esos números** en `<proj>\docs-baseline.txt` (créalo con lo pegado). Es la referencia de la Tarea 8.

- [ ] **Step 7: Punto de control** — revisar los 3 archivos creados; confirmar que `docs-baseline.txt` tiene números reales.

---

### Task 2: Instalador, desinstalador y humo de extensión

**Files:**
- Create: `<proj>\scripts\install.ps1`, `<proj>\scripts\uninstall.ps1`
- Create: `<proj>\Themes\PioneerVFDLite\user.css` (stub), `<proj>\Themes\PioneerVFDLite\color.ini`, `<proj>\Extensions\pioneerVFDLite.js` (stub)

**Interfaces:**
- Produces: `scripts\install.ps1` (idempotente; guarda respaldo una sola vez en `%APPDATA%\spicetify\pvfdlite-backup.json`), `scripts\uninstall.ps1` (restaura). Marca en el DOM: `document.documentElement.dataset.pvfdl` ∈ {`loaded`, `mounted`}.

- [ ] **Step 1: Crear los stubs**

`color.ini` (valores copiados de `Themes/PioneerVFD/color.ini` del original):

```ini
[PioneerVFDLite]
text               = 3ce0ee
subtext            = 06b2c5
sidebar-text       = 1a2030
main               = 02060c
sidebar            = 8a9095
player             = 6a7075
card               = 06121e
shadow             = 000000
selected-row       = 1a3a5c
button             = 079eaf
button-active      = 00ffff
button-disabled    = 4a5258
tab-active         = 1a3a5c
notification       = 079eaf
notification-error = ff6464
misc               = b0b4ba
```

`user.css` (stub): `/* PioneerVFD Lite — filled in Task 4 */`

`pioneerVFDLite.js` (stub):

```javascript
document.documentElement.dataset.pvfdl = "loaded";
```

- [ ] **Step 2: Escribir `scripts\install.ps1`**

```powershell
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$spice = Join-Path $env:APPDATA "spicetify"
$themeDest = Join-Path $spice "Themes\PioneerVFDLite"
$extDest = Join-Path $spice "Extensions"
$backup = Join-Path $spice "pvfdlite-backup.json"

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) { throw "install: spicetify not found in PATH" }
foreach ($f in "Themes\PioneerVFDLite\user.css", "Themes\PioneerVFDLite\color.ini", "Extensions\pioneerVFDLite.js") {
    if (-not (Test-Path (Join-Path $root $f))) { throw "install: missing source file $f" }
}

function Get-Cfg([string]$key) { (spicetify config $key | Out-String).Trim() }

# Back up the user's config once; re-running must not overwrite the original values.
if (-not (Test-Path $backup)) {
    [ordered]@{
        current_theme    = Get-Cfg current_theme
        color_scheme     = Get-Cfg color_scheme
        inject_css       = Get-Cfg inject_css
        inject_theme_js  = Get-Cfg inject_theme_js
        replace_colors   = Get-Cfg replace_colors
        overwrite_assets = Get-Cfg overwrite_assets
        expose_apis      = Get-Cfg expose_apis
    } | ConvertTo-Json | Set-Content $backup -Encoding utf8
    Write-Host "Backup written: $backup"
}

New-Item -ItemType Directory -Force $themeDest, $extDest | Out-Null
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDLite\user.css") $themeDest
Copy-Item -Force (Join-Path $root "Themes\PioneerVFDLite\color.ini") $themeDest
Copy-Item -Force (Join-Path $root "Extensions\pioneerVFDLite.js") $extDest

spicetify config current_theme PioneerVFDLite color_scheme PioneerVFDLite inject_css 1 inject_theme_js 0 replace_colors 1 overwrite_assets 0 expose_apis 1

$ext = Get-Cfg extensions
if ($ext -notmatch "(^|\|)pioneerVFDLite\.js(\||$)") {
    if ([string]::IsNullOrWhiteSpace($ext)) { spicetify config extensions pioneerVFDLite.js }
    else { spicetify config extensions "$ext|pioneerVFDLite.js" }
}

Write-Host "Applying (Spotify will restart)..."
spicetify apply
Write-Host "extensions = $(Get-Cfg extensions)"
```

- [ ] **Step 3: Escribir `scripts\uninstall.ps1`**

```powershell
$ErrorActionPreference = "Stop"
$spice = Join-Path $env:APPDATA "spicetify"
$backup = Join-Path $spice "pvfdlite-backup.json"
if (-not (Test-Path $backup)) { throw "uninstall: backup not found at $backup; nothing to restore" }
$b = Get-Content $backup -Raw | ConvertFrom-Json

spicetify config extensions pioneerVFDLite.js-
spicetify config current_theme $b.current_theme color_scheme $b.color_scheme inject_css $b.inject_css inject_theme_js $b.inject_theme_js replace_colors $b.replace_colors overwrite_assets $b.overwrite_assets expose_apis $b.expose_apis
Remove-Item -Recurse -Force (Join-Path $spice "Themes\PioneerVFDLite")
Remove-Item -Force (Join-Path $spice "Extensions\pioneerVFDLite.js")
Write-Host "Applying (Spotify will restart)..."
spicetify apply
Remove-Item -Force $backup
Write-Host "Restored: theme=$($b.current_theme) scheme=$($b.color_scheme)"
```

- [ ] **Step 4: Instalar el stub (avisar al usuario del reinicio)**

```powershell
cd C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite
.\scripts\install.ps1
```

Expected: `Backup written: ...`, y al final `extensions = pioneerVFDLite.js`.

- [ ] **Step 5: Verificar que la extensión carga en Spotify real**

```powershell
node scripts\cdp.js eval "document.documentElement.dataset.pvfdl"
```

Expected: `"loaded"`. Si imprime `null`: ver `spicetify config extensions`, y ejecutar `spicetify apply` otra vez. **Si falla dos veces, parar y reportar.**

- [ ] **Step 6: Comprobar que el desinstalador restaura (y volver a instalar)**

```powershell
.\scripts\uninstall.ps1
spicetify config current_theme
spicetify config color_scheme
.\scripts\install.ps1
```

Expected: `marketplace` y `catppuccin-mocha` tras desinstalar; después la instalación vuelve a funcionar.

- [ ] **Step 7: Punto de control** — revisar los scripts; confirmar que el respaldo se creó una sola vez.

---

### Task 3: Lógica pura con pruebas (TDD)

**Files:**
- Modify: `<proj>\Extensions\pioneerVFDLite.js` (reemplazar el stub)
- Test: `<proj>\tests\logic.test.js`

**Interfaces:**
- Produces (exportadas con `module.exports` y usadas por las Tareas 5-7):
  - `formatClock(ms: number): string` → `"m:ss"`; lanza `RangeError` si `ms` no es finito o es negativo.
  - `playbackTimes(progMs: number, durMs: number): { valid: boolean, progMs: number, durMs: number }`.
  - `findSegmentIndex(segments: {start:number}[], tSec: number): number`; lanza `RangeError` si `segments` está vacío.
  - `spectrumLevels(segment: {pitches:number[12], loudness_max:number}, bandCount: number): number[]` con valores en [0,1]; lanza `TypeError` si `pitches` no tiene 12 entradas.
  - `decay(prev: number, target: number, k: number): number` → `Math.max(target, prev * k)`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`tests\logic.test.js`:

```javascript
const test = require("node:test");
const assert = require("node:assert/strict");
const { formatClock, playbackTimes, findSegmentIndex, spectrumLevels, decay } = require("../Extensions/pioneerVFDLite.js");

test("formatClock renders minutes and zero-padded seconds", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(35000), "0:35");
  assert.equal(formatClock(349000), "5:49");
  assert.equal(formatClock(3599000), "59:59");
});

test("formatClock rejects values that are not a valid duration", () => {
  assert.throws(() => formatClock(-1), RangeError);
  assert.throws(() => formatClock(NaN), RangeError);
  assert.throws(() => formatClock(Infinity), RangeError);
});

test("playbackTimes accepts a normal position", () => {
  assert.deepEqual(playbackTimes(35000, 349000), { valid: true, progMs: 35000, durMs: 349000 });
});

test("playbackTimes tolerates a position slightly past the end and clamps it", () => {
  assert.deepEqual(playbackTimes(101500, 100000), { valid: true, progMs: 100000, durMs: 100000 });
});

test("playbackTimes flags the epoch-sized progress Spicetify can return (Liked Songs)", () => {
  assert.equal(playbackTimes(Date.now(), 200000).valid, false);
  assert.equal(playbackTimes(Date.now(), 0).valid, false);
});

test("playbackTimes flags negative, NaN and zero-duration input", () => {
  assert.equal(playbackTimes(-5, 100000).valid, false);
  assert.equal(playbackTimes(NaN, 100000).valid, false);
  assert.equal(playbackTimes(1000, 0).valid, false);
});

const segs = [{ start: 0 }, { start: 1 }, { start: 2.5 }];

test("findSegmentIndex picks the last segment that started at or before t", () => {
  assert.equal(findSegmentIndex(segs, 0.5), 0);
  assert.equal(findSegmentIndex(segs, 1), 1);
  assert.equal(findSegmentIndex(segs, 2.4), 1);
  assert.equal(findSegmentIndex(segs, 99), 2);
});

test("findSegmentIndex clamps before the first segment and rejects empty input", () => {
  assert.equal(findSegmentIndex(segs, -1), 0);
  assert.throws(() => findSegmentIndex([], 1), RangeError);
});

const pitches = Array.from({ length: 12 }, (_, i) => (i + 1) / 12);

test("spectrumLevels scales pitch energy by loudness and returns bandCount values in [0,1]", () => {
  const loud = spectrumLevels({ pitches, loudness_max: 0 }, 12);
  assert.equal(loud.length, 12);
  assert.ok(loud.every((v) => v >= 0 && v <= 1));
  assert.equal(loud[11], 1);
  const silent = spectrumLevels({ pitches, loudness_max: -60 }, 12);
  assert.ok(silent.every((v) => v === 0));
  const half = spectrumLevels({ pitches, loudness_max: -30 }, 12);
  assert.equal(half[11], 0.5);
});

test("spectrumLevels maps pitches onto a different band count", () => {
  assert.equal(spectrumLevels({ pitches, loudness_max: 0 }, 6).length, 6);
});

test("spectrumLevels rejects a segment without 12 pitches and reports the input", () => {
  assert.throws(() => spectrumLevels({ pitches: [1, 2], loudness_max: 0 }, 12), (e) => e instanceof TypeError && e.message.includes("[1,2]"));
});

test("decay falls gradually but jumps up immediately", () => {
  assert.equal(decay(1, 0, 0.8), 0.8);
  assert.equal(decay(0.2, 0.9, 0.8), 0.9);
  assert.equal(decay(0, 0, 0.8), 0);
});
```

- [ ] **Step 2: Ejecutar y comprobar que falla**

```powershell
cd C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite
node --test tests\logic.test.js
```

Expected: FAIL (el stub no exporta nada; `formatClock is not a function`).

- [ ] **Step 3: Implementar la lógica mínima**

Reemplazar `Extensions\pioneerVFDLite.js` por:

```javascript
// PioneerVFD Lite — Pioneer head-unit skin for Spotify (Spicetify).
// Single file, no build. Pure logic is exported (module.exports) so Node can test it.
(function pvfdLite() {
  "use strict";

  // ---------- pure logic (tested in tests/logic.test.js) ----------

  function formatClock(ms) {
    if (!Number.isFinite(ms) || ms < 0) throw new RangeError(`formatClock: invalid ms=${ms}`);
    const total = Math.floor(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  }

  // Spicetify derives progress as positionAsOfTimestamp + (Date.now() - timestamp); for some
  // contexts (Liked Songs) that yields a value the size of Date.now(). Such a value is not a position.
  function playbackTimes(progMs, durMs) {
    const sane = Number.isFinite(progMs) && Number.isFinite(durMs) && durMs > 0 && progMs >= 0 && progMs <= durMs + 2000;
    return sane ? { valid: true, progMs: Math.min(progMs, durMs), durMs } : { valid: false, progMs, durMs };
  }

  function findSegmentIndex(segments, tSec) {
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new RangeError(`findSegmentIndex: empty segments (tSec=${tSec})`);
    }
    if (tSec < segments[0].start) return 0;
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].start <= tSec) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function spectrumLevels(segment, bandCount) {
    const { pitches, loudness_max: loud } = segment;
    if (!Array.isArray(pitches) || pitches.length !== 12) {
      throw new TypeError(`spectrumLevels: pitches must have 12 entries, got ${JSON.stringify(pitches)}`);
    }
    const gain = Math.min(1, Math.max(0, (loud + 60) / 60));
    const out = new Array(bandCount);
    for (let i = 0; i < bandCount; i++) {
      const p = pitches[Math.floor((i * 12) / bandCount)];
      out[i] = Math.min(1, Math.max(0, p)) * gain;
    }
    return out;
  }

  function decay(prev, target, k) {
    return Math.max(target, prev * k);
  }

  const api = { formatClock, playbackTimes, findSegmentIndex, spectrumLevels, decay };
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // ---------- Spicetify runtime (added in Tasks 5-7) ----------
  if (typeof Spicetify === "undefined") return;
  document.documentElement.dataset.pvfdl = "loaded";
})();
```

- [ ] **Step 4: Ejecutar y comprobar que pasa**

```powershell
node --test tests\logic.test.js
```

Expected: `# pass 12`, `# fail 0` (12 pruebas). Pegar la salida real.

- [ ] **Step 5: Comprobar la forma real de `getAudioData` en Spotify (supuesto de la especificación)**

Reproducir una canción del catálogo (no local, no podcast) y ejecutar:

```powershell
$e = @'
(async () => {
  const uri = Spicetify.Player.data.item.uri;
  const d = await Spicetify.getAudioData(uri);
  const s = d.segments[0];
  return { uri, keys: Object.keys(d), segCount: d.segments.length, segKeys: Object.keys(s), pitchesLen: s.pitches.length, hasLoudnessMax: typeof s.loudness_max, hasStart: typeof s.start };
})()
'@
node scripts\cdp.js eval $e
```

Expected: `segKeys` incluye `start`, `pitches`, `loudness_max`; `pitchesLen: 12`.
**Si los campos son otros, parar** y corregir `spectrumLevels`/`findSegmentIndex` y sus pruebas antes de seguir.

- [ ] **Step 6: Punto de control** — revisar `tests\logic.test.js` y la lógica; la salida de `node --test` pegada.

---

### Task 4: Aspecto global (`user.css` + paleta) y fuente

**Files:**
- Modify: `<proj>\Themes\PioneerVFDLite\user.css`

**Interfaces:**
- Produces: variables CSS en `:root` que usan las Tareas 5-7: `--pvfdl-player-h`, `--pvfdl-chrome-hi|1|2|3`, `--pvfdl-edge`, `--pvfdl-lcd-bg|card|text|sub`, `--pvfdl-head`, `--pvfdl-select`, `--pvfdl-accent`, `--pvfdl-font`, `--pvfdl-glow`.

- [ ] **Step 1: Decidir la fuente (licencia sin verificar)**

La fuente por defecto es `Consolas` (viene con Windows; sin archivo). **No incluir Musieer** salvo que el usuario confirme que su licencia lo permite. Registrar la decisión en `README.md` (Tarea 8). No hay nada que descargar.

- [ ] **Step 2: Escribir `user.css`**

```css
/* PioneerVFD Lite — chassis chrome + black LCD inset + cyan phosphor.
   Palette from PioneerVFD (MIT, William Starks). Carátula styles are in the second half. */

:root {
  --pvfdl-player-h: 150px;
  --pvfdl-chrome-hi: #d4d8dc;
  --pvfdl-chrome-1: #b0b4ba;
  --pvfdl-chrome-2: #8a9095;
  --pvfdl-chrome-3: #6a7075;
  --pvfdl-edge: #1a2030;
  --pvfdl-lcd-bg: #02060c;
  --pvfdl-lcd-card: #06121e;
  --pvfdl-lcd-text: #3ce0ee;
  --pvfdl-lcd-sub: #06b2c5;
  --pvfdl-head: #2b6f94;
  --pvfdl-select: #1a3a5c;
  --pvfdl-accent: #00ffff;
  --pvfdl-font: Consolas, "Lucida Console", monospace;
  --pvfdl-glow: 0 0 6px rgba(60, 224, 238, 0.55);
}

body { font-family: var(--pvfdl-font) !important; }

/* ---------- app chrome ---------- */
.Root__top-container { background: var(--pvfdl-chrome-2); }

.Root__globalNav {
  background: linear-gradient(180deg, var(--pvfdl-chrome-hi), var(--pvfdl-chrome-1) 40%, var(--pvfdl-chrome-2)) !important;
  border-bottom: 2px solid var(--pvfdl-edge);
}

.Root__nav-bar,
.Root__right-sidebar {
  background: var(--pvfdl-lcd-bg) !important;
  border: 1px solid var(--pvfdl-edge);
}

.Root__main-view {
  background: var(--pvfdl-lcd-bg) !important;
  border: 2px solid var(--pvfdl-edge);
  box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.85);
}

.main-topBar-container { background: transparent !important; }

/* ---------- content ---------- */
.main-entityHeader-title {
  color: var(--pvfdl-lcd-text) !important;
  text-shadow: var(--pvfdl-glow);
}

.main-trackList-trackListHeaderRow {
  background: var(--pvfdl-head) !important;
  color: #d9fbff !important;
}

.main-trackList-trackListRow {
  border-bottom: 1px solid rgba(60, 224, 238, 0.12);
  border-radius: 0 !important;
}
.main-trackList-trackListRow:hover { background: var(--pvfdl-select) !important; }

.main-card-card {
  background: var(--pvfdl-lcd-card) !important;
  border: 1px solid rgba(60, 224, 238, 0.2);
  border-radius: 2px !important;
}

.main-playButton-PlayButton button,
button.main-playButton-PlayButton {
  background: linear-gradient(#e6e9ec, #9ba1a7) !important;
  color: #101820 !important;
}

/* ---------- scrollbars ---------- */
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: var(--pvfdl-lcd-bg); }
::-webkit-scrollbar-thumb { background: var(--pvfdl-chrome-3); border: 1px solid var(--pvfdl-edge); }
```

- [ ] **Step 3: Comprobar que Spicetify expone las variables de color (supuesto)**

```powershell
.\scripts\install.ps1
node scripts\cdp.js eval "getComputedStyle(document.documentElement).getPropertyValue('--spice-main').trim()"
```

Expected: `"02060c"` (u otro valor no vacío que corresponda a `main`). Si sale vacío, anotarlo: el tema no depende de `--spice-*` (usa tokens propios), así que no bloquea, pero hay que informar al usuario.

- [ ] **Step 4: Comprobar cada selector en vivo**

```powershell
$e = "['Root__top-container','Root__globalNav','Root__nav-bar','Root__main-view','Root__right-sidebar','Root__now-playing-bar','main-topBar-container'].map(c => [c, document.getElementsByClassName(c).length])"
node scripts\cdp.js eval $e
```

Expected: cada clase con ≥ 1. Cualquiera con 0: **no inventar sustituto**; reportarlo al usuario y ajustar solo esa regla tras inspeccionar el DOM con `eval`.

- [ ] **Step 5: Captura y revisión visual**

```powershell
node scripts\cdp.js shot "$env:TEMP\pvfdl-skin.png"
```

Abrir la imagen con la herramienta de lectura de imágenes y comparar con el aspecto buscado (chasis cromado arriba, LCD negro, texto cian). Ajustar el CSS en lo que se vea mal; volver a `install.ps1` + captura. **Máximo dos rondas por problema**; si no sale, parar y reportar.

- [ ] **Step 6: Punto de control** — `.\scripts\measure.ps1`; pegar tamaños (objetivo ≤ 40 KB).

---

### Task 5: Carátula (DOM + estilos) y pantalla LCD

**Files:**
- Modify: `<proj>\Extensions\pioneerVFDLite.js` (añadir el bloque de runtime)
- Modify: `<proj>\Themes\PioneerVFDLite\user.css` (añadir estilos de carátula)

**Interfaces:**
- Consumes (Tarea 3): `formatClock`, `playbackTimes`.
- Produces: `el(tag, cls, attrs)`, `button(label, id, cls)`, `buildChassis(): ui`, `mount(ui)`, `refresh(ui)`, `onSongChange(ui)` y el objeto `ui` con la forma:
  `{ chassis, knob, title, titleText, clock, tag, track, fill, canvas, ctx, btn: {src,dim,bg,rpt,like,que}, wheel: {up,down,left,right,center} }`.
- Marca DOM: `document.documentElement.dataset.pvfdl = "mounted"` tras montar.

- [ ] **Step 1: Añadir estilos de carátula al final de `user.css`**

```css
/* ---------- now-playing bar → Pioneer chassis ---------- */
.Root__now-playing-bar {
  height: var(--pvfdl-player-h) !important;
  min-height: var(--pvfdl-player-h) !important;
  max-height: var(--pvfdl-player-h) !important;
  padding: 0 !important;
  position: relative;
  display: block !important;
  overflow: hidden;
  background: linear-gradient(180deg, var(--pvfdl-chrome-hi) 0%, var(--pvfdl-chrome-1) 8%, var(--pvfdl-chrome-2) 45%, var(--pvfdl-chrome-3) 100%) !important;
  border-top: 2px solid var(--pvfdl-edge) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* Keep Spotify's native player alive but invisible: lyrics extensions attach controls there. */
.Root__now-playing-bar.pvfdl-mounted > *:not(.pvfdl-chassis) {
  position: absolute !important;
  inset: 0;
  opacity: 0 !important;
  pointer-events: none !important;
  z-index: 0;
}

.pvfdl-chassis {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 92px 64px minmax(0, 1fr) 64px 92px;
  gap: 12px;
  align-items: center;
  height: 100%;
  padding: 10px 16px;
  box-sizing: border-box;
  font-family: var(--pvfdl-font);
}

/* ----- LCD ----- */
.pvfdl-lcd {
  position: relative;
  display: grid;
  grid-template-rows: auto 6px 64px;
  gap: 8px;
  padding: 8px 10px;
  min-width: 0;
  color: var(--pvfdl-lcd-text);
  background: var(--pvfdl-lcd-bg);
  border: 2px solid var(--pvfdl-edge);
  border-radius: 3px;
  box-shadow: inset 0 0 14px rgba(0, 0, 0, 0.9), 0 1px 0 rgba(255, 255, 255, 0.5);
}
.pvfdl-dim .pvfdl-lcd { opacity: 0.5; }

.pvfdl-lcd-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  letter-spacing: 1px;
  text-shadow: var(--pvfdl-glow);
}
.pvfdl-title { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; }
.pvfdl-title-text { display: inline-block; }
.pvfdl-clock { white-space: nowrap; font-variant-numeric: tabular-nums; }

.pvfdl-scroll .pvfdl-title-text {
  will-change: transform;
  animation: pvfdl-marquee 12s linear infinite alternate;
}
@keyframes pvfdl-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(var(--pvfdl-scroll-dist, 0)); }
}
@media (prefers-reduced-motion: reduce) {
  .pvfdl-scroll .pvfdl-title-text { animation: none; }
}

.pvfdl-track { position: relative; height: 6px; background: rgba(60, 224, 238, 0.15); cursor: pointer; }
.pvfdl-track::before { content: ""; position: absolute; inset: -6px 0; }
.pvfdl-fill {
  width: 100%;
  height: 100%;
  background: var(--pvfdl-lcd-text);
  box-shadow: var(--pvfdl-glow);
  transform-origin: 0 50%;
  transform: scaleX(var(--pvfdl-frac, 0));
}

.pvfdl-canvas { display: block; width: 100%; height: 64px; image-rendering: pixelated; }
.pvfdl-tag { position: absolute; right: 12px; bottom: 10px; font-size: 10px; letter-spacing: 1px; color: var(--pvfdl-lcd-sub); }

/* ----- buttons ----- */
.pvfdl-btncol { display: grid; gap: 6px; }
.pvfdl-btn {
  height: 22px;
  border: 1px solid var(--pvfdl-edge);
  border-radius: 2px;
  font: 700 10px/1 var(--pvfdl-font);
  letter-spacing: 1px;
  color: #101820;
  background: linear-gradient(#e6e9ec, #9ba1a7);
  box-shadow: inset 0 1px 0 #fff;
  cursor: pointer;
}
.pvfdl-btn:hover { background: linear-gradient(#f2f4f6, #aab0b6); }
.pvfdl-btn[aria-pressed="true"] {
  color: #d9fbff;
  background: linear-gradient(#0a4f5a, #079eaf);
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
}

/* ----- volume knob ----- */
.pvfdl-knob {
  position: relative;
  justify-self: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  cursor: ns-resize;
  touch-action: none;
  background: radial-gradient(circle at 35% 30%, #f6f8fa 0%, #b4bac0 35%, #6c7278 100%);
  box-shadow: 0 0 0 3px #05080d, 0 0 0 5px var(--pvfdl-lcd-sub), 0 2px 6px rgba(0, 0, 0, 0.6);
}
.pvfdl-knob::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 6px;
  width: 4px;
  height: 14px;
  margin-left: -2px;
  background: var(--pvfdl-edge);
  transform-origin: 50% 38px;
  transform: rotate(var(--pvfdl-angle, -135deg));
}

/* ----- navigation wheel ----- */
.pvfdl-wheel {
  justify-self: center;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  display: grid;
  grid-template-areas: ". up ." "left center right" ". down .";
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  background: radial-gradient(circle, #0a1a26 0 30%, #7f868c 31% 100%);
  box-shadow: 0 0 0 3px #05080d, 0 0 0 5px var(--pvfdl-lcd-sub), 0 2px 6px rgba(0, 0, 0, 0.6);
}
.pvfdl-w { border: 0; background: transparent; color: var(--pvfdl-lcd-text); font-size: 13px; cursor: pointer; padding: 0; }
.pvfdl-w:hover { color: var(--pvfdl-accent); }
.pvfdl-w-up { grid-area: up; }
.pvfdl-w-down { grid-area: down; }
.pvfdl-w-left { grid-area: left; }
.pvfdl-w-right { grid-area: right; }
.pvfdl-w-center { grid-area: center; }
```

- [ ] **Step 2: Añadir el runtime de DOM a `pioneerVFDLite.js`**

Reemplazar las dos últimas líneas del bloque ("// ---------- Spicetify runtime ..." y `if (typeof Spicetify === "undefined") return;` + marca `loaded`) por:

```javascript
  // ---------- Spicetify runtime ----------
  if (typeof Spicetify === "undefined") return;
  document.documentElement.dataset.pvfdl = "loaded";

  const BANDS = 12;
  const state = { analysis: null, analysisError: null, levels: new Array(BANDS).fill(0), bg: true, warnedBadProgress: false };

  async function waitFor(fn, label, timeoutMs = 20000) {
    const t0 = Date.now();
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() - t0 > timeoutMs) throw new Error(`pvfdLite: timed out after ${timeoutMs} ms waiting for ${label}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  function el(tag, cls, attrs = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function button(label, id, cls = "pvfdl-btn") {
    const b = el("button", cls, { type: "button", "data-testid": `pvfdl-${id}`, "aria-label": label });
    b.textContent = label;
    return b;
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function buildChassis() {
    const chassis = el("div", "pvfdl-chassis", { "data-testid": "pvfdl-chassis" });

    const knob = el("div", "pvfdl-knob", {
      "data-testid": "pvfdl-knob", role: "slider", tabindex: "0",
      "aria-label": "Volume", "aria-valuemin": "0", "aria-valuemax": "100",
    });

    const btn = {
      src: button("SRC", "src"), dim: button("DIM", "dim"), bg: button("BG", "bg"),
      rpt: button("RPT", "rpt"), like: button("LIKE", "like"), que: button("QUE", "que"),
    };
    const left = el("div", "pvfdl-btncol");
    left.append(btn.src, btn.dim, btn.bg);
    const right = el("div", "pvfdl-btncol");
    right.append(btn.rpt, btn.like, btn.que);

    const lcd = el("div", "pvfdl-lcd");
    const head = el("div", "pvfdl-lcd-head");
    const title = el("div", "pvfdl-title");
    const titleText = el("span", "pvfdl-title-text");
    title.append(titleText);
    const clock = el("div", "pvfdl-clock");
    head.append(title, clock);
    const track = el("div", "pvfdl-track", { "data-testid": "pvfdl-track", role: "slider", "aria-label": "Seek" });
    const fill = el("div", "pvfdl-fill");
    track.append(fill);
    const canvas = el("canvas", "pvfdl-canvas", { width: "320", height: "64" });
    const tag = el("div", "pvfdl-tag");
    lcd.append(head, track, canvas, tag);

    const wheelEl = el("div", "pvfdl-wheel", { "data-testid": "pvfdl-wheel" });
    const wheel = {
      up: button("▲", "w-up", "pvfdl-w pvfdl-w-up"),
      down: button("▼", "w-down", "pvfdl-w pvfdl-w-down"),
      left: button("◀", "w-left", "pvfdl-w pvfdl-w-left"),
      right: button("▶", "w-right", "pvfdl-w pvfdl-w-right"),
      center: button("⏯", "w-center", "pvfdl-w pvfdl-w-center"),
    };
    wheelEl.append(wheel.up, wheel.down, wheel.left, wheel.right, wheel.center);

    chassis.append(knob, left, lcd, right, wheelEl);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("pvfdLite: canvas 2d context unavailable");
    return { chassis, knob, title, titleText, clock, tag, track, fill, canvas, ctx, btn, wheel };
  }

  function mount(ui, bar) {
    bar.classList.add("pvfdl-mounted");
    bar.appendChild(ui.chassis);
    const colors = getComputedStyle(ui.chassis);
    ui.colors = { text: colors.getPropertyValue("--pvfdl-lcd-text").trim(), sub: colors.getPropertyValue("--pvfdl-lcd-sub").trim() };
    if (!ui.colors.text || !ui.colors.sub) {
      throw new Error(`pvfdLite: LCD colour variables missing from user.css, got ${JSON.stringify(ui.colors)}`);
    }
    document.documentElement.dataset.pvfdl = "mounted";
  }

  function pressed(node, on) {
    node.setAttribute("aria-pressed", String(Boolean(on)));
  }

  // ~4 Hz state sync: clock, progress, knob angle, toggle states.
  function refresh(ui) {
    const P = Spicetify.Player;
    const t = playbackTimes(P.getProgress(), P.getDuration());
    if (!t.valid && t.durMs > 0 && !state.warnedBadProgress) {
      state.warnedBadProgress = true;
      console.warn(`pvfdLite: unusable playback position progMs=${t.progMs} durMs=${t.durMs}; showing --:--`);
    }
    setText(ui.clock, t.valid ? `${formatClock(t.progMs)} / ${formatClock(t.durMs)}` : "--:-- / --:--");
    ui.fill.style.setProperty("--pvfdl-frac", t.valid ? (t.progMs / t.durMs).toFixed(4) : "0");

    const vol = P.getVolume();
    ui.knob.style.setProperty("--pvfdl-angle", `${-135 + vol * 270}deg`);
    ui.knob.setAttribute("aria-valuenow", String(Math.round(vol * 100)));

    pressed(ui.btn.src, P.getShuffle());
    pressed(ui.btn.like, P.getHeart());
    const rep = P.getRepeat();
    pressed(ui.btn.rpt, rep > 0);
    setText(ui.btn.rpt, rep === 2 ? "RPT 1" : "RPT");
    pressed(ui.btn.bg, state.bg);
  }

  function onSongChange(ui) {
    const item = Spicetify.Player.data && Spicetify.Player.data.item;
    const text = item
      ? `${(item.artists && item.artists[0] && item.artists[0].name) || "UNKNOWN"} - ${item.name}`.toUpperCase()
      : "NO DISC";
    setText(ui.titleText, text);
    requestAnimationFrame(() => {
      const over = ui.titleText.scrollWidth - ui.title.clientWidth;
      ui.title.classList.toggle("pvfdl-scroll", over > 0);
      ui.title.style.setProperty("--pvfdl-scroll-dist", `${-Math.max(over, 0)}px`);
    });
  }

  async function start() {
    await waitFor(() => Spicetify.Player && Spicetify.Platform && Spicetify.getAudioData, "Spicetify.Player/Platform/getAudioData");
    const bar = await waitFor(() => document.querySelector(".Root__now-playing-bar"), ".Root__now-playing-bar");
    const ui = buildChassis();
    mount(ui, bar);
    onSongChange(ui);
    refresh(ui);
    Spicetify.Player.addEventListener("songchange", () => onSongChange(ui));
    setInterval(() => { if (!document.hidden) refresh(ui); }, 250);
    // Tasks 6 and 7 extend start() here: bindControls(ui), analysis loading and the draw loop.
  }

  start();
```

Y mantener al final `})();`.

- [ ] **Step 3: Pruebas de la lógica siguen pasando**

```powershell
node --test tests\logic.test.js
```

Expected: `# pass 12`, `# fail 0` (el bloque de runtime no corre en Node porque `Spicetify` no existe).

- [ ] **Step 4: Instalar y comprobar montaje**

```powershell
.\scripts\install.ps1
node scripts\cdp.js eval "[document.documentElement.dataset.pvfdl, !!document.querySelector('[data-testid=pvfdl-chassis]'), document.querySelector('.pvfdl-clock')?.textContent, document.querySelector('.pvfdl-title-text')?.textContent]"
```

Expected: `["mounted", true, "<m:ss / m:ss>", "<ARTISTA - TÍTULO>"]` con una canción cargada.
Revisar consola: `node scripts\cdp.js eval "1"` no muestra errores; para errores de la extensión usar DevTools del usuario o `Runtime.consoleAPICalled` si hace falta. **Si no monta, mostrar el error exacto; máximo dos intentos antes de parar.**

- [ ] **Step 5: Captura y revisión visual**

```powershell
node scripts\cdp.js shot "$env:TEMP\pvfdl-chassis.png"
```

Leer la imagen y comparar con `preview.png` del original (pantalla negra con texto cian, perilla a la izquierda, rueda a la derecha). Ajustar CSS, máximo dos rondas.

- [ ] **Step 6: Punto de control** — `.\scripts\measure.ps1`; pegar tamaños.

---

### Task 6: Controles (perilla, rueda, botones, barra de progreso)

**Files:**
- Modify: `<proj>\Extensions\pioneerVFDLite.js`

**Interfaces:**
- Consumes (Tarea 5): `ui`, `state`, `pressed`, `refresh`.
- Produces: `bindControls(ui)`, `nudgeVolume(delta)`.

- [ ] **Step 1: Añadir `nudgeVolume` y `bindControls` antes de `async function start()`**

```javascript
  const VOL_STEP = 0.05;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  function nudgeVolume(delta) {
    Spicetify.Player.setVolume(clamp01(Spicetify.Player.getVolume() + delta));
  }

  function bindControls(ui) {
    const P = Spicetify.Player;

    // Knob: wheel, vertical drag, arrow keys.
    let dragY = null;
    let dragVol = 0;
    ui.knob.addEventListener("pointerdown", (e) => {
      dragY = e.clientY;
      dragVol = P.getVolume();
      ui.knob.setPointerCapture(e.pointerId);
    });
    ui.knob.addEventListener("pointermove", (e) => {
      if (dragY === null) return;
      P.setVolume(clamp01(dragVol + (dragY - e.clientY) / 150));
    });
    const endDrag = () => { dragY = null; };
    ui.knob.addEventListener("pointerup", endDrag);
    ui.knob.addEventListener("pointercancel", endDrag);
    ui.knob.addEventListener("wheel", (e) => {
      e.preventDefault();
      nudgeVolume(e.deltaY < 0 ? VOL_STEP : -VOL_STEP);
    }, { passive: false });
    ui.knob.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") nudgeVolume(VOL_STEP);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") nudgeVolume(-VOL_STEP);
      else return;
      e.preventDefault();
    });

    // Navigation wheel.
    ui.wheel.up.addEventListener("click", () => nudgeVolume(VOL_STEP));
    ui.wheel.down.addEventListener("click", () => nudgeVolume(-VOL_STEP));
    ui.wheel.left.addEventListener("click", () => P.back());
    ui.wheel.right.addEventListener("click", () => P.next());
    ui.wheel.center.addEventListener("click", () => P.togglePlay());

    // Buttons.
    ui.btn.src.addEventListener("click", () => P.toggleShuffle());
    ui.btn.rpt.addEventListener("click", () => P.toggleRepeat());
    ui.btn.like.addEventListener("click", () => P.toggleHeart());
    ui.btn.que.addEventListener("click", () => Spicetify.Platform.History.push("/queue"));
    ui.btn.dim.addEventListener("click", () => {
      const on = ui.chassis.classList.toggle("pvfdl-dim");
      pressed(ui.btn.dim, on);
    });
    ui.btn.bg.addEventListener("click", () => {
      state.bg = !state.bg;
      pressed(ui.btn.bg, state.bg);
      kick(ui);
    });

    // Seek by clicking the progress bar.
    ui.track.addEventListener("pointerdown", (e) => {
      const dur = P.getDuration();
      if (!(dur > 0)) {
        console.warn(`pvfdLite: seek ignored, duration=${dur}`);
        return;
      }
      const rect = ui.track.getBoundingClientRect();
      P.seek(clamp01((e.clientX - rect.left) / rect.width) * dur);
    });
  }
```

`kick` se define en la Tarea 7. Para que el archivo sea coherente en esta tarea, añadir **temporalmente** justo debajo de `bindControls`:

```javascript
  function kick() {} // replaced in Task 7
```

- [ ] **Step 2: Llamar a `bindControls(ui)` dentro de `start()`**, justo después de `refresh(ui);`:

```javascript
    bindControls(ui);
```

- [ ] **Step 3: Verificar valores reales de `getRepeat()` y la ruta `/queue` (supuestos)**

```powershell
node scripts\cdp.js eval "[Spicetify.Player.getRepeat(), Spicetify.Player.getShuffle(), Spicetify.Player.getHeart(), Spicetify.Player.getVolume()]"
```

Expected: `getRepeat` ∈ {0,1,2}. Pulsar el botón RPT del usuario (o `Spicetify.Player.toggleRepeat()` por `eval`) y volver a leer para comprobar la secuencia y que `RPT 1` aparezca con el valor correcto. Si la secuencia no es 0/1/2, corregir `refresh`.

- [ ] **Step 4: Instalar y probar cada control con el estado real**

```powershell
.\scripts\install.ps1
$e = @'
(async () => {
  const q = (id) => document.querySelector(`[data-testid="pvfdl-${id}"]`);
  const v0 = Spicetify.Player.getVolume();
  q("w-up").click(); await new Promise(r => setTimeout(r, 300));
  const v1 = Spicetify.Player.getVolume();
  q("w-down").click(); await new Promise(r => setTimeout(r, 300));
  const v2 = Spicetify.Player.getVolume();
  const s0 = Spicetify.Player.getShuffle();
  q("src").click(); await new Promise(r => setTimeout(r, 600));
  const s1 = Spicetify.Player.getShuffle();
  q("src").click(); await new Promise(r => setTimeout(r, 600));
  return { v0, v1, v2, s0, s1, s2: Spicetify.Player.getShuffle(), pressedSrc: q("src").getAttribute("aria-pressed") };
})()
'@
node scripts\cdp.js eval $e
```

Expected: `v1 > v0` (salvo que ya estuviera al máximo), `v2 ≈ v0`, `s1 !== s0`, `s2 === s0`. Pegar la salida real.
Los controles `back`, `next`, `togglePlay`, `like` y `que` los prueba el usuario a mano (cambian su música y su biblioteca); **no ejecutarlos por CDP sin avisar**, sobre todo `like`.

- [ ] **Step 5: Punto de control** — revisar `bindControls`; confirmar con el usuario que perilla (arrastre y rueda), rueda y botones responden.

---

### Task 7: Espectro real, fondo animado y bucle de dibujo

**Files:**
- Modify: `<proj>\Extensions\pioneerVFDLite.js`

**Interfaces:**
- Consumes: `findSegmentIndex`, `spectrumLevels`, `decay`, `playbackTimes`, `state`, `ui.ctx`, `ui.colors`, `BANDS`.
- Produces: `loadAnalysis(ui)`, `draw(ui, now)`, `kick(ui)`.

- [ ] **Step 1: Sustituir el `kick` temporal por el bucle real** (borrar la línea `function kick() {} // replaced in Task 7` y añadir antes de `async function start()`):

```javascript
  // ---------- spectrum + background ----------
  let rafId = 0;
  let lastDraw = 0;

  function updateLevels(t) {
    let target = null;
    if (state.analysis && t.valid && Spicetify.Player.isPlaying()) {
      const seg = state.analysis[findSegmentIndex(state.analysis, t.progMs / 1000)];
      target = spectrumLevels(seg, BANDS);
    }
    for (let i = 0; i < BANDS; i++) state.levels[i] = decay(state.levels[i], target ? target[i] : 0, 0.82);
  }

  function draw(ui, now) {
    const { ctx, canvas } = ui;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (state.bg) {
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = ui.colors.sub;
      const off = Math.floor(now / 60) % 6;
      for (let y = off - 6; y < h; y += 6) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;
    }

    const P = Spicetify.Player;
    updateLevels(playbackTimes(P.getProgress(), P.getDuration()));

    const bw = Math.floor(w / BANDS);
    ctx.fillStyle = ui.colors.text;
    for (let i = 0; i < BANDS; i++) {
      const bh = Math.round(state.levels[i] * (h - 4));
      for (let y = h; y > h - bh; y -= 5) ctx.fillRect(i * bw + 2, y - 4, bw - 4, 4);
    }
  }

  function frame(ui, now) {
    rafId = 0;
    if (document.hidden) return; // resumed by visibilitychange
    if (now - lastDraw >= 33) {
      lastDraw = now;
      draw(ui, now);
    }
    if (Spicetify.Player.isPlaying() || state.levels.some((l) => l > 0.01)) {
      rafId = requestAnimationFrame((n) => frame(ui, n));
    }
  }

  function kick(ui) {
    if (rafId || document.hidden) return;
    rafId = requestAnimationFrame((n) => frame(ui, n));
  }

  function loadAnalysis(ui) {
    const item = Spicetify.Player.data && Spicetify.Player.data.item;
    state.analysis = null;
    state.analysisError = null;
    setText(ui.tag, "");
    if (!item) return;
    const uri = item.uri;
    Spicetify.getAudioData(uri)
      .then((d) => {
        if (Spicetify.Player.data.item.uri !== uri) return; // track changed meanwhile
        if (!d || !Array.isArray(d.segments) || d.segments.length === 0) {
          throw new Error(`getAudioData returned no segments for ${uri}: ${JSON.stringify(d && Object.keys(d))}`);
        }
        state.analysis = d.segments;
        kick(ui);
      })
      .catch((err) => {
        if (Spicetify.Player.data.item.uri !== uri) return;
        state.analysisError = err;
        console.error(`pvfdLite: getAudioData failed uri=${uri}`, err);
        setText(ui.tag, "NO DATA");
      });
  }
```

- [ ] **Step 2: Cambiar la firma de `kick` en `bindControls`**: ya llama a `kick(ui)` (Tarea 6); no requiere cambios.

- [ ] **Step 3: Enganchar en `start()`** (sustituir el comentario `// Tasks 6 and 7 extend start() here...` y ajustar los listeners):

```javascript
    Spicetify.Player.addEventListener("songchange", () => {
      onSongChange(ui);
      loadAnalysis(ui);
      kick(ui);
    });
    Spicetify.Player.addEventListener("onplaypause", () => kick(ui));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(ui); });
    loadAnalysis(ui);
    kick(ui);
```

Y **eliminar** el listener de `songchange` anterior de la Tarea 5 (`Spicetify.Player.addEventListener("songchange", () => onSongChange(ui));`) para no registrarlo dos veces.

- [ ] **Step 4: Pruebas y tamaño**

```powershell
node --test tests\logic.test.js
.\scripts\measure.ps1
```

Expected: `# pass 12`; extensión ≤ 30 KB.

- [ ] **Step 5: Instalar y verificar el espectro con reproducción real**

```powershell
.\scripts\install.ps1
$e = @'
(async () => {
  await new Promise(r => setTimeout(r, 1500));
  const c = document.querySelector(".pvfdl-canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) lit++;
  return { playing: Spicetify.Player.isPlaying(), litPixels: lit, tag: document.querySelector(".pvfdl-tag").textContent };
})()
'@
node scripts\cdp.js eval $e
```

Expected con una canción sonando: `litPixels > 0` y `tag: ""`. Con la canción en pausa: `litPixels` baja a 0 en ~1 s (la rejilla de fondo usa `alpha ≈ 30`, por eso el umbral es 200). Con una pista local o podcast: `tag: "NO DATA"` y un `console.error` con URI.

- [ ] **Step 6: Captura con la música sonando**

```powershell
node scripts\cdp.js shot "$env:TEMP\pvfdl-spectrum.png"
```

Leer la imagen. Comprobar barras cian segmentadas sobre rejilla tenue.

- [ ] **Step 7: Punto de control** — revisar el bucle; confirmar que se detiene en pausa y con la ventana oculta (Step 8).

- [ ] **Step 8: Comprobar que el bucle se detiene**

Pausar la música y ejecutar:

```powershell
node scripts\cdp.js eval "new Promise(r => { let n = 0; const c = document.querySelector('.pvfdl-canvas'); const ctx = c.getContext('2d'); const orig = ctx.clearRect.bind(ctx); ctx.clearRect = (...a) => { n++; return orig(...a); }; setTimeout(() => { ctx.clearRect = orig; r(n); }, 3000); })"
```

Expected: `0` (o 1-2 en el primer segundo mientras decaen las barras), nunca ~90. Si sale ~90, el bucle sigue activo en pausa: es un fallo de diseño; reportar y corregir `frame`.

---

### Task 8: Verificación final, medición y limpieza

**Files:**
- Create: `<proj>\README.md`

- [ ] **Step 1: Pruebas y tamaños**

```powershell
cd C:\Users\Mario\Downloads\VFD\pioneer-vfd-lite
node --test tests\logic.test.js
.\scripts\measure.ps1
```

Expected: `# pass 12`, `# fail 0`; tamaños frente al presupuesto (CSS ≤ 40 KB, JS ≤ 30 KB). Pegar la salida real. Si se supera, **decirlo**; no ajustar el presupuesto después.

- [ ] **Step 2: Contar reglas prohibidas en el CSS**

```powershell
$c = Get-Content .\Themes\PioneerVFDLite\user.css -Raw
"backdrop-filter: " + ([regex]::Matches($c, 'backdrop-filter')).Count
"blur(:           " + ([regex]::Matches($c, 'blur\(')).Count
"!important:      " + ([regex]::Matches($c, '!important')).Count
"text-shadow:     " + ([regex]::Matches($c, 'text-shadow')).Count
```

Expected: `backdrop-filter: 0`, `blur(: 0`. Registrar `!important` y `text-shadow` (original: 3346 y 202).

- [ ] **Step 3: CPU frente a la línea base** (música sonando; mismo método que la Tarea 1 Paso 6)

```powershell
node scripts\cdp.js perf 20
Get-Content .\docs-baseline.txt
```

Comparar `taskCpuPerSec`. Criterio: diferencia ≤ 0.03 (3 puntos porcentuales de un núcleo). Pegar ambos resultados. Si no se cumple, decirlo con los números; no declarar éxito.

- [ ] **Step 4: Captura final y revisión visual con el usuario**

```powershell
node scripts\cdp.js shot "$env:TEMP\pvfdl-final.png"
```

Leer la imagen, describir lo que se ve, y pedir al usuario que confirme el aspecto y pruebe back/next/play, like y QUE (acciones que no se ejecutan por CDP).

- [ ] **Step 5: Probar en el caso "Liked Songs"** (progreso inválido conocido)

Con el usuario, abrir Liked Songs y reproducir; comprobar que el reloj muestra un tiempo real o `--:-- / --:--`, nunca un número del tamaño del epoch. Anotar el resultado.

- [ ] **Step 6: Limpiar efectos secundarios**

```powershell
spicetify config spotify_launch_flags ""
spicetify config spotify_launch_flags
```

Expected: el valor vuelve a vacío (si imprime comillas o texto, ajustar con `spicetify config spotify_launch_flags " "` y revisarlo). El cambio de flags se aplica en el próximo arranque de Spotify por Spicetify; avisar al usuario.
No hay emuladores ni daemons de Android implicados; no hace falta `stop-android-dev.ps1`.

- [ ] **Step 7: Escribir `README.md`** (uso breve: instalar con `.\scripts\install.ps1`, quitar con `.\scripts\uninstall.ps1`, fuente `Consolas` y por qué, atribución a `LICENSE-NOTICE.md`, números medidos en este paso).

- [ ] **Step 8: Cierre**

Informar al usuario: qué quedó verificado (con salida), qué se probó solo a mano, cualquier presupuesto incumplido. Proponer: (a) crear un `CLAUDE.md` del proyecto con las rutas y comandos de arriba (la regla global lo pide para trabajo recurrente); (b) guardar en memoria el criterio no obvio: "espectro con `getAudioData`, `NO DATA` en vez de espectro inventado".

---

## Autorrevisión

**Cobertura de la especificación**

| Requisito | Tarea |
|---|---|
| Tema ligero: CSS + `color.ini` + extensión sin build | 2, 4, 5 |
| Pantalla LCD de texto (título, reloj, progreso) | 5 |
| Perilla, rueda y botones | 5 (DOM), 6 (comportamiento) |
| Espectro real con `getAudioData`; `NO DATA` si falla | 3 (lógica y forma real), 7 |
| Fondo animado ligero en un solo canvas ≤ 30 fps y detenido | 7 |
| Player nativo vivo y oculto | 5 (CSS) |
| Manejo del progreso inválido (Liked Songs) | 3, 5, 8 |
| Presupuesto de tamaño y CPU, medido | 1 (base), 8 |
| Sin `backdrop-filter` ni `blur` | 4, 8 |
| Respaldo y restauración de la config del usuario | 2 |
| Licencia y atribución MIT | 1, 8 |
| Fuente: decisión por defecto `Consolas` | 4 |

**Búsqueda de marcadores pendientes:** el único elemento diferido es `README.md` (Tarea 8, Paso 7) y su contenido está especificado. No quedan "TBD".

**Consistencia de nombres:** `formatClock`, `playbackTimes`, `findSegmentIndex`, `spectrumLevels`, `decay` (T3) coinciden con su uso en T5 y T7. `ui` y `state` (T5) coinciden en T6 y T7. `kick(ui)` se usa en T6 con la firma definitiva de T7 (el stub temporal ignora el argumento). `BANDS = 12` se define en T5 y lo usan `updateLevels` y `draw` en T7.

**Riesgos abiertos (sin verificar hasta ejecutar):** forma de `getAudioData` (T3 Paso 5), valores de `getRepeat` y ruta `/queue` (T6), variables `--spice-*` (T4), clases de Spotify que cambien con una actualización (T4 Paso 4), eliminación de la extensión con `pioneerVFDLite.js-` (T2 Paso 6).
