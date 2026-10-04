import { relative } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { biomeReport, type Report } from "../biome/report.ts";
import { loadConfig } from "../config/load.ts";
import { SetupFailure } from "../failure.ts";
import { posix } from "../inventory/ignore-scope.ts";
import { walk } from "../inventory/walk.ts";
import { sortManifests } from "../manifests/sorted.ts";
import { plural } from "../report/plural.ts";

export const MAX_FIX_ROUNDS = 5;

function biome(root: string, args: readonly string[]): Effect.Effect<Report, SetupFailure> {
	return Effect.tryPromise({
		catch: (cause) => new SetupFailure({ message: cause instanceof Error ? cause.message : String(cause) }),
		try: () => biomeReport(root, args),
	});
}

function snapshotOf(root: string): Effect.Effect<ReadonlyMap<string, string>, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const paths = yield* walk(root);
		const contents = yield* Effect.forEach(paths, (path) =>
			Effect.map(fs.readFile(path), (bytes) => [posix(relative(root, path)), Buffer.from(bytes).toString("base64")] as const),
		);
		return new Map(contents);
	}).pipe(Effect.mapError((failure) => new SetupFailure({ message: failure.message })));
}

function biomeRound(root: string, index: number): Effect.Effect<number, SetupFailure> {
	return Effect.gen(function* () {
		const fixed = (yield* biome(root, ["check", "--write", "--unsafe"])).summary.changed;
		const formatted = (yield* biome(root, ["format", "--write"])).summary.changed;
		yield* Console.log(
			`quality: Biome round ${index} rewrote ${plural(fixed, "file")} with fixes and ${plural(formatted, "file")} with the format pass.`,
		);
		return fixed + formatted;
	});
}

export interface Settling<Failure, Requirements> {
	readonly round: (index: number) => Effect.Effect<number, Failure, Requirements>;
	readonly snapshot: Effect.Effect<ReadonlyMap<string, string>, Failure, Requirements>;
}

function unsettled(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): SetupFailure {
	const changed = [...new Set([...before.keys(), ...after.keys()])]
		.filter((path) => before.get(path) !== after.get(path))
		.sort((left, right) => left.localeCompare(right));
	return new SetupFailure({
		message: [
			`Biome still rewrote files after ${MAX_FIX_ROUNDS} rounds, so quality fix stopped. These files changed in the last round:`,
			...changed.map((path) => `  ${path}`),
			"Two fixes probably undo each other there. Fix the code by hand, or turn off one of the rules.",
		].join("\n"),
	});
}

export function settle<Failure, Requirements>({
	round,
	snapshot,
}: Settling<Failure, Requirements>): Effect.Effect<void, Failure | SetupFailure, Requirements> {
	return Effect.gen(function* () {
		for (let index = 1; index < MAX_FIX_ROUNDS; index += 1) {
			if ((yield* round(index)) === 0) {
				return;
			}
		}
		const before = yield* snapshot;
		if ((yield* round(MAX_FIX_ROUNDS)) === 0) {
			return;
		}
		return yield* unsettled(before, yield* snapshot);
	});
}

export function fix(cwd: string, config: string | undefined): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { root } = yield* loadConfig(cwd, config);
		const sorted = yield* Effect.mapError(sortManifests(root), (failure) => new SetupFailure({ message: failure.message }));
		yield* Console.log(`quality: sort-package-json rewrote ${plural(sorted, "manifest")}.`);
		yield* settle({ round: (index) => biomeRound(root, index), snapshot: snapshotOf(root) });
	});
}
