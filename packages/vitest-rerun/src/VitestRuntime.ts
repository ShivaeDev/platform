import { Context, type Effect, type FileSystem, type PlatformError, type Schema, type Scope } from "effect";
import type { VitestRerunError } from "#error.ts";
import type { Snapshot } from "#snapshot.ts";
import type { Files, SnapshotSummary } from "#tasks.ts";

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

export interface AttemptRunner {
	collect: (files: Files, summary: Snapshot["summary"]) => Effect.Effect<void>;
	finish: (
		outputDir: string,
		attempt: number,
		reports: RunOptions["reports"],
	) => Effect.Effect<void, PlatformError.PlatformError | Schema.SchemaError | VitestRerunError, FileSystem.FileSystem>;
	read: () => Effect.Effect<{
		errors: unknown[];
		files: Files;
		root: string;
		summary: SnapshotSummary;
	}>;
	rerun: (selected: readonly Selection[]) => Effect.Effect<undefined, VitestRerunError>;
	start: () => Effect.Effect<void, VitestRerunError>;
}

export class VitestRuntime extends Context.Service<
	VitestRuntime,
	{ readonly open: (input: RunOptions) => Effect.Effect<AttemptRunner, VitestRerunError, Scope.Scope> }
>()("@shivaedev/vitest-rerun/VitestRuntime") {}
