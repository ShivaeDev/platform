import { relative } from "node:path";
import { Console, Effect, type FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline } from "../baseline/format.ts";
import { guardBaseline } from "../baseline/guard.ts";
import { decodeLegacyBaseline, LEGACY_BASELINE } from "../baseline/legacy.ts";
import { loadConfig } from "../config/load.ts";
import { validOrFail } from "../decoded.ts";
import { readBaseline } from "../engine/baseline-file.ts";
import { GateFailed, type SetupFailure } from "../failure.ts";
import { type Base, resolveBase } from "../git/base.ts";
import type { Git } from "../git/command.ts";
import { changesSince, readAt } from "../git/history.ts";
import { renderGuard } from "../report/guard.ts";

const baseEntries = (root: string, base: Base, path: string): Effect.Effect<ReadonlyArray<BaselineEntry>, SetupFailure, Git> =>
	Effect.gen(function* () {
		const raw = yield* readAt(root, base.commit, path);
		if (raw !== undefined) {
			return yield* validOrFail(`${path} at ${base.ref}`, yield* Effect.promise(() => decodeBaseline(raw)));
		}
		const legacy = yield* readAt(root, base.commit, LEGACY_BASELINE);
		return legacy === undefined
			? []
			: yield* validOrFail(`${LEGACY_BASELINE} at ${base.ref}`, yield* Effect.promise(() => decodeLegacyBaseline(legacy)));
	});

export const checkBaseline = (
	cwd: string,
	configPath: string | undefined,
	against: string | undefined,
): Effect.Effect<void, SetupFailure | GateFailed, FileSystem.FileSystem | Git> =>
	Effect.gen(function* () {
		const config = yield* loadConfig(cwd, configPath);
		const working = yield* readBaseline(config);
		const base = yield* resolveBase(config.root, against);
		const { moves } = yield* changesSince(config.root, [base.commit]);
		const renames = new Map([...moves].map(([from, to]) => [to, from]));
		const before = yield* baseEntries(config.root, base, renames.get(config.baseline) ?? config.baseline);
		const result = guardBaseline(before, working.entries, renames, config.adopt);
		yield* Console.log(renderGuard(result, { base, baseline: config.baseline, config: relative(config.root, config.file) }));
		if (result.problems.length > 0) {
			return yield* new GateFailed();
		}
	});
