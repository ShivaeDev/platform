import { join } from "node:path";
import { Effect, type FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline } from "#baseline/format.ts";
import { LEGACY_BASELINE } from "#baseline/legacy.ts";
import type { ResolvedConfig } from "#config/load.ts";
import { validOrFail } from "#decoded.ts";
import { SetupFailure } from "#failure.ts";
import { readOptionalText } from "#inventory/filesystem.ts";

export interface BaselineFile {
	readonly entries: readonly BaselineEntry[];
	readonly raw: string | undefined;
}

export const readInput = (root: string, path: string): Effect.Effect<string | undefined, SetupFailure, FileSystem.FileSystem> =>
	Effect.mapError(readOptionalText(join(root, path)), (failure) => new SetupFailure({ message: failure.message }));

export const readBaseline = (config: ResolvedConfig): Effect.Effect<BaselineFile, SetupFailure, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const raw = yield* readInput(config.root, config.baseline);
		if (raw === undefined && config.baseline !== LEGACY_BASELINE && (yield* readInput(config.root, LEGACY_BASELINE)) !== undefined) {
			return yield* new SetupFailure({
				message: `${LEGACY_BASELINE} holds a baseline in the earlier JSON format. Run \`quality baseline migrate\` to move it to ${config.baseline}.`,
			});
		}
		return { entries: yield* validOrFail(config.baseline, yield* Effect.promise(() => decodeBaseline(raw))), raw };
	});
