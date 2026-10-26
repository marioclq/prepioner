// PioneerVFD — Claude edition: Pioneer head-unit skin for Spotify (Spicetify).
// Single file, no build. Pure logic is exported (module.exports) so Node can test it.
(function pioneerVFDClaude() {
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

  // ---------- Spicetify runtime ----------
  if (typeof Spicetify === "undefined") return;
  document.documentElement.dataset.pvc = "loaded";

  const BANDS = 12;
  const VOL_STEP = 0.05;
  const state = {
    analysis: null,
    analysisError: null,
    levels: new Array(BANDS).fill(0),
    peaks: new Array(BANDS).fill(0),
    bg: true,
    warnedBadProgress: false,
  };
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  // Polls fn until it returns a truthy value. fn may throw while the host is still booting; the last
  // such error is kept and reported if the wait times out, so a real failure is never hidden.
  async function waitFor(fn, label, timeoutMs = 20000) {
    const t0 = Date.now();
    let lastError = null;
    for (;;) {
      try {
        const v = fn();
        if (v) return v;
      } catch (e) {
        lastError = e;
      }
      if (Date.now() - t0 > timeoutMs) {
        throw new Error(`pioneerVFDClaude: timed out after ${timeoutMs} ms waiting for ${label}${lastError ? `; last error: ${lastError.message}` : ""}`);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  function el(tag, cls, attrs = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  function button(label, id, cls = "pvc-btn") {
    const b = el("button", cls, { type: "button", "data-testid": `pvc-${id}`, "aria-label": label });
    b.textContent = label;
    return b;
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function pressed(node, on) {
    node.setAttribute("aria-pressed", String(Boolean(on)));
  }

  // ---------- DOM ----------

  function buildChassis() {
    const chassis = el("div", "pvc-chassis", { "data-testid": "pvc-chassis" });

    const knob = el("div", "pvc-knob", {
      "data-testid": "pvc-knob", role: "slider", tabindex: "0",
      "aria-label": "Volume", "aria-valuemin": "0", "aria-valuemax": "100",
    });
    knob.append(el("div", "pvc-ring"));

    const btn = {
      src: button("SRC", "src"), dim: button("DIM", "dim"), bg: button("BG", "bg"),
      rpt: button("RPT", "rpt"), like: button("LIKE", "like"), que: button("QUE", "que"),
    };
    const left = el("div", "pvc-btncol");
    left.append(btn.src, btn.dim, btn.bg);
    const right = el("div", "pvc-btncol");
    right.append(btn.rpt, btn.like, btn.que);

    const lcd = el("div", "pvc-lcd");
    const head = el("div", "pvc-lcd-head");
    const title = el("div", "pvc-title");
    const titleText = el("span", "pvc-title-text");
    title.append(titleText);
    const clock = el("div", "pvc-clock");
    head.append(title, clock);

    const track = el("div", "pvc-track", { "data-testid": "pvc-track", role: "slider", tabindex: "0", "aria-label": "Seek" });
    const segs = el("div", "pvc-segs");
    const fill = el("div", "pvc-fill");
    segs.append(fill);
    track.append(segs, el("div", "pvc-head"));

    const canvas = el("canvas", "pvc-canvas", { width: "320", height: "64" });
    const tag = el("div", "pvc-tag");
    lcd.append(head, track, canvas, tag);

    const wheelEl = el("div", "pvc-wheel", { "data-testid": "pvc-wheel" });
    const wheel = {
      up: button("▲", "w-up", "pvc-w pvc-w-up"),
      down: button("▼", "w-down", "pvc-w pvc-w-down"),
      left: button("◀", "w-left", "pvc-w pvc-w-left"),
      right: button("▶", "w-right", "pvc-w pvc-w-right"),
      center: button("⏯", "w-center", "pvc-w pvc-w-center"),
    };
    wheelEl.append(wheel.up, wheel.down, wheel.left, wheel.right, wheel.center);

    chassis.append(knob, left, lcd, right, wheelEl);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("pioneerVFDClaude: canvas 2d context unavailable");
    return { chassis, knob, title, titleText, clock, tag, track, fill, canvas, ctx, btn, wheel };
  }

  function mount(ui, bar) {
    bar.classList.add("pvc-mounted");
    bar.appendChild(ui.chassis);
    const cs = getComputedStyle(ui.chassis);
    ui.colors = {
      text: cs.getPropertyValue("--pvc-text").trim(),
      sub: cs.getPropertyValue("--pvc-sub").trim(),
      peak: cs.getPropertyValue("--pvc-peak").trim(),
    };
    if (!ui.colors.text || !ui.colors.sub || !ui.colors.peak) {
      throw new Error(`pioneerVFDClaude: LCD colour variables missing from user.css, got ${JSON.stringify(ui.colors)}`);
    }
    document.documentElement.dataset.pvc = "mounted";
  }

  // ~4 Hz state sync: clock, progress, knob, toggle states.
  function refresh(ui) {
    const P = Spicetify.Player;
    const t = playbackTimes(P.getProgress(), P.getDuration());
    if (!t.valid && t.durMs > 0 && !state.warnedBadProgress) {
      state.warnedBadProgress = true;
      console.warn(`pioneerVFDClaude: unusable playback position progMs=${t.progMs} durMs=${t.durMs}; showing --:--`);
    }
    const uri = P.data && P.data.item ? P.data.item.uri : null;
    if (uri !== ui.lastUri) {
      ui.lastUri = uri;
      onSongChange(ui);
      loadAnalysis(ui);
      kick(ui);
    }
    setText(ui.clock, t.valid ? `${formatClock(t.progMs)} / ${formatClock(t.durMs)}` : "--:-- / --:--");
    ui.track.style.setProperty("--pvc-frac", t.valid ? (t.progMs / t.durMs).toFixed(4) : "0");

    const vol = P.getVolume();
    ui.knob.style.setProperty("--pvc-angle", `${-135 + vol * 270}deg`);
    ui.knob.style.setProperty("--pvc-vol", vol.toFixed(3));
    ui.knob.setAttribute("aria-valuenow", String(Math.round(vol * 100)));

    ui.chassis.classList.toggle("pvc-playing", Boolean(P.isPlaying()));
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
      ? `${(item.artists && item.artists[0] && item.artists[0].name) || "UNKNOWN"} - ${item.name}`
      : "NO DISC";
    setText(ui.titleText, text);
    requestAnimationFrame(() => {
      const over = ui.titleText.scrollWidth - ui.title.clientWidth;
      ui.title.classList.toggle("pvc-scroll", over > 0);
      ui.title.style.setProperty("--pvc-scroll-dist", `${-Math.max(over, 0)}px`);
    });
  }

  // ---------- controls ----------

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

    // Keys.
    ui.btn.src.addEventListener("click", () => P.toggleShuffle());
    ui.btn.rpt.addEventListener("click", () => P.toggleRepeat());
    ui.btn.like.addEventListener("click", () => P.toggleHeart());
    ui.btn.que.addEventListener("click", () => Spicetify.Platform.History.push("/queue"));
    ui.btn.dim.addEventListener("click", () => {
      pressed(ui.btn.dim, ui.chassis.classList.toggle("pvc-dim"));
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
        console.warn(`pioneerVFDClaude: seek ignored, duration=${dur}`);
        return;
      }
      const rect = ui.track.getBoundingClientRect();
      P.seek(clamp01((e.clientX - rect.left) / rect.width) * dur);
    });
  }

  // ---------- spectrum + background (one canvas, ≤30 fps, stops when idle) ----------

  let rafId = 0;
  let lastDraw = 0;

  function updateLevels(t) {
    let target = null;
    if (state.analysis && t.valid && Spicetify.Player.isPlaying()) {
      const seg = state.analysis[findSegmentIndex(state.analysis, t.progMs / 1000)];
      target = spectrumLevels(seg, BANDS);
    }
    for (let i = 0; i < BANDS; i++) {
      state.levels[i] = decay(state.levels[i], target ? target[i] : 0, 0.82);
      state.peaks[i] = decay(state.peaks[i], state.levels[i], 0.975);
    }
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
    for (let i = 0; i < BANDS; i++) {
      const bh = Math.round(state.levels[i] * (h - 4));
      const x = i * bw + 2;
      // Glow without blur: a wider, low-alpha column behind the lit cells.
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = ui.colors.text;
      ctx.fillRect(x - 2, h - bh, bw, bh);
      ctx.globalAlpha = 1;
      for (let y = h; y > h - bh; y -= 5) ctx.fillRect(x, y - 4, bw - 4, 4);
      // Peak-hold cap.
      const py = h - Math.round(state.peaks[i] * (h - 4));
      if (state.peaks[i] > 0.02) {
        ctx.fillStyle = ui.colors.peak;
        ctx.fillRect(x, Math.max(0, py - 4), bw - 4, 2);
        ctx.fillStyle = ui.colors.text;
      }
    }
  }

  function frame(ui, now) {
    rafId = 0;
    if (document.hidden) return; // resumed by visibilitychange
    if (now - lastDraw >= 33) {
      lastDraw = now;
      draw(ui, now);
    }
    if (Spicetify.Player.isPlaying() || state.levels.some((l) => l > 0.01) || state.peaks.some((p) => p > 0.02)) {
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
    delete ui.tag.dataset.error;
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
        console.error(`pioneerVFDClaude: getAudioData failed uri=${uri}`, err);
        ui.tag.dataset.error = String((err && err.message) || err);
        setText(ui.tag, "NO DATA");
      });
  }

  // ---------- start ----------

  async function start() {
    // getProgress() throws until Spotify's player state exists, so probe it rather than just checking for the object.
    await waitFor(() => {
      if (!(Spicetify.Player && Spicetify.Platform && Spicetify.getAudioData)) return false;
      Spicetify.Player.getProgress();
      return true;
    }, "Spicetify player state");
    const bar = await waitFor(() => document.querySelector(".Root__now-playing-bar"), ".Root__now-playing-bar");
    const ui = buildChassis();
    mount(ui, bar);
    refresh(ui); // also draws the title and loads the spectrum data for the current track
    bindControls(ui);

    Spicetify.Player.addEventListener("songchange", () => refresh(ui));
    Spicetify.Player.addEventListener("onplaypause", () => {
      refresh(ui);
      kick(ui);
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(ui); });
    setInterval(() => { if (!document.hidden) refresh(ui); }, 250);

    state.levels.fill(1); // power-on self-test: bars start full and fall away on their own
    kick(ui);
  }

  start();
})();
