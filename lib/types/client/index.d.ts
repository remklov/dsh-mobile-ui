import type { Context } from '@deepseek-ai/cordis';
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots';
export declare const name = "dsh-mobile-workbench";
export declare const inject: string[];
type ClientContext = Context & {
    layout: ILayout;
    slots: Pick<SlotCore, 'register'>;
};
/** Additive current-layout slot registration; no shell replacement or runtime shim. */
export declare function apply(ctx: ClientContext): void;
export {};
