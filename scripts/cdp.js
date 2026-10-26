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
  const listeners = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.method) { listeners.forEach((fn) => fn(msg)); return; }
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
  return { send, on: (fn) => listeners.push(fn), close: () => ws.close() };
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
      // Note: Page.captureScreenshot with `clip` never returns in Spotify; crop the PNG afterwards instead.
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
    } else if (cmd === "reset") {
      // A hung clipped screenshot leaves a device-metrics override behind; this removes it.
      await cdp.send("Emulation.clearDeviceMetricsOverride");
      console.log("device metrics override cleared");
    } else if (cmd === "logs") {
      // logs <seconds> [reload]: print console messages and exceptions; "reload" reloads the page first.
      const seconds = Number(arg);
      if (!(seconds > 0)) throw new Error(`usage: cdp.js logs <seconds> [reload], got ${arg}`);
      cdp.on((msg) => {
        if (msg.method === "Runtime.exceptionThrown") {
          const d = msg.params.exceptionDetails;
          console.log(`EXCEPTION ${(d.exception && d.exception.description) || d.text} @ line ${d.lineNumber}:${d.columnNumber}`);
        } else if (msg.method === "Runtime.consoleAPICalled" && /pioneerVFDClaude|pvc/i.test(JSON.stringify(msg.params.args))) {
          console.log(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ")}`);
        }
      });
      await cdp.send("Runtime.enable");
      if (process.argv[4] === "reload") await cdp.send("Page.reload");
      await new Promise((r) => setTimeout(r, seconds * 1000));
    } else {
      throw new Error(`unknown command "${cmd}". Use eval | shot | perf | logs | reset`);
    }
  } finally {
    cdp.close();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
