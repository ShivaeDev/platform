import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { decodeBaseline } from "#baseline/format.ts";
import { convertLegacy, decodeLegacyBaseline, LEGACY_BASELINE } from "#baseline/legacy.ts";
import { saveShards, shardPaths } from "#baseline/shards.ts";
import { loadConfig } from "#config/load.ts";
import { validOrFail } from "#decoded.ts";
import { readInput } from "#engine/baselineFile.ts";
import { scan } from "#engine/session.ts";
import { SetupFailure } from "#failure.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices } from "#rule.ts";

export const migrateBaseline = Effect.fn("Cli.migrateBaseline")(function* (
	cwd: string,
	configPath: string | undefined,
	from: string | undefined,
): Effect.fn.Return<void, SetupFailure, RuleServices> {
	const config = yield* loadConfig(cwd, configPath);
	const source = from ?? LEGACY_BASELINE;
	const paths = yield* shardPaths(config).pipe(Effect.mapError((error) => new SetupFailure({ cause: error, message: error.message })));
	const existing = yield* Effect.forEach(paths, (path) => readInput(config.root, path));
	if (source === config.baseline || existing.some((text) => text !== undefined)) {
		return yield* new SetupFailure({ message: `${config.baseline} already exists. Migrate into a baseline file that does not exist yet.` });
	}
	const raw = yield* readInput(config.root, source);
	if (raw === undefined) {
		return yield* new SetupFailure({ message: `no baseline at ${source} to migrate. Name it with --from <file>.` });
	}
	const legacy = source.endsWith(".jsonl")
		? yield* validOrFail(source, yield* Effect.promise(() => decodeBaseline(raw)))
		: yield* validOrFail(source, yield* Effect.promise(() => decodeLegacyBaseline(raw)));
	const entries = source.endsWith(".jsonl") ? legacy : convertLegacy(legacy, (yield* scan(config)).violations);
	const fs = yield* FileSystem.FileSystem;
	const written = Effect.andThen(saveShards(config, new Map(), entries), fs.remove(join(config.root, source)));
	yield* Effect.mapError(written, (failure) => new SetupFailure({ cause: failure, message: failure.message }));
	const fixed = legacy.length - entries.length;
	const dropped = fixed > 0 ? `, dropping ${plural(fixed, "fixed entry", "fixed entries")}` : "";
	yield* Console.log(`quality: moved ${plural(entries.length, "entry", "entries")} from ${source} to ${config.baseline}${dropped}.`);
});
