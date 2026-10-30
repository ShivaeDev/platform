import { join } from "node:path";
import { Effect, type FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline } from "#baseline/format.ts";
import { LEGACY_BASELINE } from "#baseline/legacy.ts";
import { type Shard, shardOf, shardPaths } from "#baseline/shards.ts";
import type { ResolvedConfig } from "#config/load.ts";
import { validOrFail } from "#decoded.ts";
import { SetupFailure } from "#failure.ts";
import { readOptionalText } from "#inventory/filesystem.ts";

export interface BaselineFile {
	readonly entries: readonly BaselineEntry[];
	readonly files: ReadonlyMap<string, Shard>;
}

export function readInput(root: string, path: string): Effect.Effect<string | undefined, SetupFailure, FileSystem.FileSystem> {
	return Effect.mapError(readOptionalText(join(root, path)), (failure) => new SetupFailure({ cause: failure, message: failure.message }));
}

export const readBaseline = Effect.fn("Engine.readBaseline")(function* (
	config: ResolvedConfig,
): Effect.fn.Return<BaselineFile, SetupFailure, FileSystem.FileSystem> {
	const files = new Map<string, Shard>();
	for (const path of yield* shardPaths(config).pipe(Effect.mapError((error) => new SetupFailure({ cause: error, message: error.message })))) {
		const raw = yield* readInput(config.root, path);
		if (raw === undefined) {
			continue;
		}
		const entries = yield* validOrFail(path, yield* Effect.promise(() => decodeBaseline(raw)));
		for (const entry of entries) {
			const expected = shardOf(entry.file, config.baseline);
			if (expected !== path) {
				return yield* new SetupFailure({ message: `${entry.file} belongs in ${expected}, not ${path}.` });
			}
		}
		files.set(path, { entries, raw });
	}
	for (const source of ["quality/baseline.jsonl", LEGACY_BASELINE]) {
		if (source !== config.baseline && (yield* readInput(config.root, source)) !== undefined) {
			return yield* new SetupFailure({
				message: `${source} holds an earlier baseline. Run \`quality baseline migrate --from ${source}\` to move it to ${config.baseline} and package shards.`,
			});
		}
	}
	return { entries: [...files.values()].flatMap((file) => file.entries), files };
});
