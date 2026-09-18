import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const BASE = "/auth/mobile-workbench-pwa";
export declare const WORKER_PATH = "/auth/mobile-workbench-pwa/sw.js";
export declare const MANIFEST_PATH = "/auth/mobile-workbench-pwa/manifest.webmanifest";
/** No hostnames, user data, tokens, or environment values enter the manifest. */
export declare const manifest: {
    readonly id: "/auth/mobile-workbench-pwa/app";
    readonly name: "DSH Mobile Workbench";
    readonly short_name: "DSH";
    readonly description: "Mobile access to your existing DeepSeek Harness workspace";
    readonly start_url: "/";
    readonly scope: "/";
    readonly display: "standalone";
    readonly background_color: "#101827";
    readonly theme_color: "#101827";
    readonly icons: readonly [{
        readonly src: "/auth/mobile-workbench-pwa/icons/icon-192.png";
        readonly sizes: "192x192";
        readonly type: "image/png";
        readonly purpose: "any";
    }, {
        readonly src: "/auth/mobile-workbench-pwa/icons/icon-512.png";
        readonly sizes: "512x512";
        readonly type: "image/png";
        readonly purpose: "any";
    }, {
        readonly src: "/auth/mobile-workbench-pwa/icons/maskable-512.png";
        readonly sizes: "512x512";
        readonly type: "image/png";
        readonly purpose: "maskable";
    }];
};
/** Intentionally NO CacheStorage, offline page, or auth interception. The
 * fetch handler exists solely to satisfy Chrome's installability check and
 * is a no-op.
 * The browser's network stack remains authoritative for every request.
 */
export declare const workerScript = "// DSH Mobile Workbench v0.1.0 \u2014 network-only worker.\nself.addEventListener('install', (event) => {\n  event.waitUntil(self.skipWaiting());\n});\nself.addEventListener('activate', (event) => {\n  event.waitUntil(self.clients.claim());\n});\n// Present only because Chrome requires a registered fetch handler before it\n// will offer installation. It deliberately never calls respondWith(), so every\n// request goes straight to the network exactly as it would without a worker \u2014\n// no caching, no offline page, no auth interception.\nself.addEventListener('fetch', () => {});\n";
/** Do not replace a pre-existing PWA owner. Only the shell index is transformed;
 * auth plugins' separately served login pages are not touched.
 */
export declare function injectHead(html: string): string;
export type AssetReader = (name: string) => Buffer;
export declare const iconPaths: string[];
/** Fixed public installation assets. Register as exact routes only: no broad
 * public prefix, dynamic lookup, query-derived content, or user data. */
export declare function createPwaHandler(readAsset?: AssetReader): (req: IncomingMessage, res: ServerResponse) => void;
