/** Pure, dependency-free mobile calculations; no access to auth or application state. */
export declare const MOBILE_QUERY = "(max-width: 767px)";
export declare const WORKER_PATH = "/auth/mobile-workbench-pwa/sw.js";
export interface ViewportSample {
    height: number;
    offsetTop: number;
    scale: number;
}
/** Use the visual viewport only for an unzoomed keyboard-reduced viewport. */
export declare function keyboardViewport(layoutHeight: number, viewport: ViewportSample | null, editing: boolean): {
    height: number;
    top: number;
} | null;
export declare function isOwnWorker(scriptURL: string, origin: string): boolean;
export declare function isOwnManifest(href: string, origin: string): boolean;
export declare function isAppleMobile(userAgent: string, platform: string, touchPoints: number): boolean;
/** Layout 0.1.5 has independent narrow (<1024) and desktop sidebar preferences. */
export declare function shouldRestoreSidebar(width: number, initialCollapsed: boolean, currentCollapsed: boolean): boolean;
