// src/host/pwa.ts
import { readFileSync } from "node:fs";
var BASE = "/auth/mobile-workbench-pwa";
var WORKER_PATH = `${BASE}/sw.js`;
var MANIFEST_PATH = `${BASE}/manifest.webmanifest`;
var manifest = {
  // Plugin-specific identity prevents collisions with an older root-id shortcut.
  id: `${BASE}/app`,
  name: "DSH Mobile Workbench",
  short_name: "DSH",
  description: "Mobile access to your existing DeepSeek Harness workspace",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#101827",
  theme_color: "#101827",
  icons: [
    { src: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: `${BASE}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: `${BASE}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};
var workerScript = `// DSH Mobile Workbench v0.1.0 \u2014 network-only worker.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
// Present only because Chrome requires a registered fetch handler before it
// will offer installation. It deliberately never calls respondWith(), so every
// request goes straight to the network exactly as it would without a worker \u2014
// no caching, no offline page, no auth interception.
self.addEventListener('fetch', () => {});
`;
var HEAD = [
  // Anonymous mode is intentional: Android installation services may fetch the
  // manifest/icons outside the signed-in tab's cookie jar.
  `<link data-mobile-workbench-head rel="manifest" href="${MANIFEST_PATH}" crossorigin="anonymous">`,
  '<meta data-mobile-workbench-head name="mobile-web-app-capable" content="yes">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-capable" content="yes">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-title" content="DSH">',
  '<meta data-mobile-workbench-head name="apple-mobile-web-app-status-bar-style" content="default">',
  `<link data-mobile-workbench-head rel="apple-touch-icon" href="${BASE}/icons/apple-touch-icon.png">`
].join("\n");
var MANIFEST_LINK = /<link\b[^>]*\brel\s*=\s*(?:["']manifest["']|manifest(?=\s|>))[^>]*>/gi;
var SHELL_MANIFEST_HREF = /\bhref\s*=\s*["']\.?\/?manifest\.webmanifest["']/i;
function injectHead(html) {
  if (/data-mobile-workbench-head/i.test(html)) return html;
  const existing = html.match(MANIFEST_LINK) ?? [];
  if (existing.some((tag) => !SHELL_MANIFEST_HREF.test(tag))) return html;
  if (!/<head(?:\s[^>]*)?>/i.test(html)) return html;
  html = html.replace(MANIFEST_LINK, "");
  let output = html.replace(/<meta\b(?=[^>]*\bname\s*=\s*["']viewport["'])[^>]*>/gi, (tag) => {
    if (/viewport-fit\s*=/i.test(tag)) return tag;
    return tag.replace(/\bcontent\s*=\s*(["'])(.*?)\1/i, (_match, quote, value) => `content=${quote}${value}, viewport-fit=cover${quote}`);
  });
  if (!/<meta\b[^>]*\bname\s*=\s*["']viewport["']/i.test(output)) {
    output = output.replace(/<head(?:\s[^>]*)?>/i, '$&\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
  }
  return output.replace(/<head(?:\s[^>]*)?>/i, `$&
${HEAD}
`);
}
var defaultAssetReader = (name2) => readFileSync(new URL(`../assets/${name2}`, import.meta.url));
var icons = /* @__PURE__ */ new Set(["icon-192.png", "icon-512.png", "maskable-512.png", "apple-touch-icon.png"]);
var iconPaths = [...icons].map((name2) => `${BASE}/icons/${name2}`);
function createPwaHandler(readAsset = defaultAssetReader) {
  return (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.writeHead(405);
      res.end();
      return;
    }
    let path;
    try {
      path = new URL(req.url ?? "/", "http://localhost").pathname;
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    let body;
    if (path === MANIFEST_PATH) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      body = JSON.stringify(manifest);
    } else if (path === WORKER_PATH) {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.setHeader("Service-Worker-Allowed", "/");
      body = workerScript;
    } else {
      const filename = path.startsWith(`${BASE}/icons/`) ? path.slice(`${BASE}/icons/`.length) : "";
      if (!icons.has(filename)) {
        res.writeHead(404);
        res.end();
        return;
      }
      try {
        body = readAsset(filename);
      } catch {
        res.writeHead(500);
        res.end();
        return;
      }
      res.setHeader("Content-Type", "image/png");
    }
    res.writeHead(200);
    res.end(req.method === "HEAD" ? void 0 : body);
  };
}

// src/index.ts
var name = "dsh-mobile-workbench";
var inject = ["webServer"];
function apply(ctx) {
  const handler = createPwaHandler();
  const routes = [MANIFEST_PATH, WORKER_PATH, ...iconPaths].map((path) => ctx.webServer.register({ kind: "exact", path, handler }));
  ctx.effect(
    () => () => {
      for (const dispose of routes.reverse()) dispose();
    },
    "mobile-workbench: exact static PWA routes"
  );
  ctx.effect(() => ctx.webServer.tapIndex(injectHead), "mobile-workbench: PWA head metadata");
}
export {
  apply,
  inject,
  name
};
