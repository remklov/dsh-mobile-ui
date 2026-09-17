import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-mobile-workbench";
export declare const inject: string[];
/** Host-only entry: no listener, auth cookie, proxy, session, or filesystem state. */
export declare function apply(ctx: Context): void;
