import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client';
export interface MobileSnapshot {
    mobile: boolean;
    drawerOpen: boolean;
    detailsOpen: boolean;
}
export interface MobileAdapter {
    toggle(): void;
    close(): void;
    dispose(): void;
    frame: HTMLElement;
}
/**
 * Minimal structural adapter for 0.1.5 AppFrame. No hashed classes or shell copy.
 * The public overlay marker anchors the frame; its two unmarked column children
 * are the native sidebar and center. Unknown structures are left untouched.
 */
export declare function attachMobileAdapter(root: HTMLElement, layout: Pick<ILayout, 'toggleSidebar'>, changed: (state: MobileSnapshot) => void): MobileAdapter | null;
