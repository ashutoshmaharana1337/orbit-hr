// Self-contained dev page — no build step, no external assets, so it works
// served directly off the API with nothing else running but this process.
export const DEBUG_PAGE_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Orbit HR — request log</title>
<style>
  body { font: 13px/1.4 ui-monospace, monospace; margin: 0; padding: 16px; background: #0b0d12; color: #d7dbe0; }
  h1 { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: #fff; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #22262e; white-space: nowrap; }
  th { color: #8b93a0; font-weight: 500; }
  .m-GET { color: #6ea8fe; } .m-POST { color: #7ee787; } .m-PATCH { color: #f2cc60; }
  .m-DELETE { color: #f87171; } .m-PUT { color: #f2cc60; }
  .s-2 { color: #7ee787; } .s-4 { color: #f2cc60; } .s-5 { color: #f87171; }
  .empty { color: #8b93a0; padding: 8px; }
</style>
</head>
<body>
<h1>Backend request log — updates every second</h1>
<table><thead><tr><th>Time</th><th>Method</th><th>Path</th><th>Status</th><th>ms</th></tr></thead>
<tbody id="rows"><tr><td class="empty" colspan="5">Waiting for requests…</td></tr></tbody></table>
<script src="/api/debug/script.js"></script>
</body>
</html>
`;

// Served from its own same-origin endpoint (see DebugController) rather than
// inlined in DEBUG_PAGE_HTML — the app's CSP (helmet's default script-src
// 'self') blocks inline <script> tags, so an inline version would render
// but silently never run.
export const DEBUG_PAGE_SCRIPT = `
async function tick() {
  try {
    const res = await fetch('/api/debug/requests', { credentials: 'include' });
    if (!res.ok) return;
    const entries = await res.json();
    const rows = document.getElementById('rows');
    if (!entries.length) { rows.innerHTML = '<tr><td class="empty" colspan="5">No requests yet.</td></tr>'; return; }
    rows.innerHTML = entries.map(function (e) {
      var t = new Date(e.time).toLocaleTimeString();
      return '<tr><td>' + t + '</td>' +
        '<td class="m-' + e.method + '">' + e.method + '</td>' +
        '<td>' + e.path + '</td>' +
        '<td class="s-' + String(e.status)[0] + '">' + e.status + '</td>' +
        '<td>' + e.durationMs + '</td></tr>';
    }).join('');
  } catch {}
}
tick();
setInterval(tick, 1000);
`;
