import { join } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { encodeBaseline } from "../baseline/format.ts";
import { decodeLegacyBaseline, LEGACY_BASELINE } from "../baseline/legacy.ts";
import { loadConfig } from "../config/load.ts";
import { validOrFail } from "../decoded.ts";
import { readInput } from "../engine/baseline-file.ts";
import { SetupFailure } from "../failure.ts";
import { writeText } from "../inventory/filesystem.ts";
import { plural } from "../report/plural.ts";

export const migrateBaseline = (
	cwd: string,
	configPath: string | undefined,
	from: string | undefined,
): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const config = yield* loadConfig(cwd, configPath);
		const source = from ?? LEGACY_BASELINE;
		if (source === config.baseline || (yield* readInput(config.root, config.baseline)) !== undefined) {
			return yield* new SetupFailure({ message: `${config.baseline} already exists. Migrate into a baseline file that does not exist yet.` });
		}
		const raw = yield* readInput(config.root, source);
		if (raw === undefined) {
			return yield* new SetupFailure({ message: `no baseline at ${source} to migrate. Name it with --from <file>.` });
		}
		const entries = yield* validOrFail(source, yield* Effect.promise(() => decodeLegacyBaseline(raw)));
		const fs = yield* FileSystem.FileSystem;
		const written = Effect.andThen(writeText(join(config.root, config.baseline), encodeBaseline(entries)), fs.remove(join(config.root, source)));
		yield* Effect.mapError(written, (failure) => new SetupFailure({ message: failure.message }));
		yield* Console.log(`quality: moved ${plural(entries.length, "entry", "entries")} from ${source} to ${config.baseline}.`);
	});
