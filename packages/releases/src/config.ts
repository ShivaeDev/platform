import type { Effect, FileSystem, PlatformError } from "effect";
import type { ChangesetError } from "#error.ts";
import type { ReleasePlan } from "#model.ts";

export interface HookContext {
	readonly plan: ReleasePlan;
	readonly root: string;
}
export type ReleaseHook = (context: HookContext) => Effect.Effect<void, ChangesetError | PlatformError.PlatformError, FileSystem.FileSystem>;
export interface ChangesetConfig {
	readonly hooks?: readonly ReleaseHook[];
	readonly packages?: readonly string[];
}
export function defineConfig(config: ChangesetConfig): ChangesetConfig {
	return config;
}
