import { Context, type Effect } from "effect";
import type { open } from "#adapters/open.ts";

export interface Selection {
	readonly fileId: string;
	readonly testIds?: string[];
}

export interface RunOptions {
	readonly cacheDir?: string;
	readonly reports: { readonly json: string; readonly junit: string };
	readonly rerun: boolean;
	readonly vitestArgs: readonly string[];
}

export type AttemptRunner = Effect.Success<ReturnType<typeof open>>;

export class VitestRuntime extends Context.Service<VitestRuntime, { readonly open: typeof open }>()("@shivaedev/vitest-rerun/VitestRuntime") {}
