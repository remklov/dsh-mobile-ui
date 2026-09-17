import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const BASE = "/mobile-workbench";
export declare const WORKER_PATH = "/mobile-workbench/sw.js";
export declare const MANIFEST_PATH = "/mobile-workbench/manifest.webmanifest";
/** No hostnames, user data, tokens, or environment values enter the manifest. */
export declare const manifest: {
    readonly id: "/";
    readonly name: "DSH Mobile Workbench";
    readonly short_name: "DSH";
    readonly description: "Mobile access to your existing DeepSeek Harness workspace";
    readonly start_url: "/";
    readonly scope: "/";
    readonly display: "standalone";
    readonly background_color: "#101827";
    readonly theme_color: "#101827";
    readonly icons: readonly [{
        readonly src: "/mobile-workbench/icons/icon-192.png";
        readonly sizes: "192x192";
        readonly type: "image/png";
        readonly purpose: "any";
    }, {
        readonly src: "/mobile-workbench/icons/icon-512.png";
        readonly sizes: "512x512";
        readonly type: "image/png";
        readonly purpose: "any";
    }, {
        readonly src: "/mobile-workbench/icons/maskable-512.png";
        readonly sizes: "512x512";
        readonly type: "image/png";
        readonly purpose: "maskable";
    }];
};
/** Intentionally NO fetch handler, CacheStorage, offline page, or auth interception.
 * The browser's network stack remains authoritative for every request.
 */
export declare const workerScript = "// DSH Mobile Workbench v0.1.0 \u2014 network-only worker.\nself.addEventListener('install', (event) => {\n  event.waitUntil(self.skipWaiting());\n});\nself.addEventListener('activate', (event) => {\n  event.waitUntil(self.clients.claim());\n});\n";
/** Do not replace a pre-existing PWA owner. Only the shell index is transformed;
 * auth plugins' separately served login pages are not touched.
 */
export declare function injectHead(html: string): string;
export type AssetReader = (name: string) => Buffer;
/** Static, allowlisted routes. Existing host/auth middleware stays in charge. */
export declare function createPwaHandler(readAsset?: AssetReader): (req: IncomingMessage, res: ServerResponse) => void;
