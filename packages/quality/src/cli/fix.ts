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

function isBinary(bytes: Uint8Array): boolean {
	return bytes.includes(0);
}

export function snapshotOf(root: string): Effect.Effect<ReadonlyMap<string, string>, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const decoder = new TextDecoder();
		const paths = yield* walk(root);
		const texts = yield* Effect.forEach(paths, (path) =>
			Effect.map(fs.readFile(path), (bytes) => (isBinary(bytes) ? [] : [[posix(relative(root, path)), decoder.decode(bytes)] as const])),
		);
		return new Map(texts.flat());
	}).pipe(Effect.mapError((failure) => new SetupFailure({ message: failure.message })));
}

export interface Pass<Failure, Requirements> {
	readonly label: string;
	readonly run: Effect.Effect<number, Failure, Requirements>;
}

export interface Settling<Failure, Requirements> {
	readonly passes: ReadonlyArray<Pass<Failure, Requirements>>;
	readonly snapshot: Effect.Effect<ReadonlyMap<string, string>, Failure, Requirements>;
}

function changedBy(root: string, args: readonly string[]): Effect.Effect<number, SetupFailure> {
	return Effect.map(biome(root, args), (report) => report.summary.changed);
}

function biomePasses(root: string): ReadonlyArray<Pass<SetupFailure, never>> {
	return [
		{
			label: "with fixes",
			run: changedBy(root, ["check", "--write", "--unsafe", "--skip=assist/source/useSortedKeys", "--skip=lint/suspicious/noDuplicateObjectKeys"]),
		},
		{ label: "with the format pass", run: changedBy(root, ["format", "--write"]) },
	];
}

function round<Failure, Requirements>(
	passes: ReadonlyArray<Pass<Failure, Requirements>>,
	index: number,
	afterEachPass: Effect.Effect<void, Failure, Requirements>,
): Effect.Effect<number, Failure, Requirements> {
	return Effect.gen(function* () {
		let total = 0;
		const parts: string[] = [];
		for (const pass of passes) {
			const changed = yield* pass.run;
			total += changed;
			parts.push(`${plural(changed, "file")} ${pass.label}`);
			yield* afterEachPass;
		}
		yield* Console.log(`quality: Biome round ${index} rewrote ${parts.join(" and ")}.`);
		return total;
	});
}

function changedBetween(before: ReadonlyMap<string, string>, after: ReadonlyMap<string, string>): readonly string[] {
	return [...new Set([...before.keys(), ...after.keys()])].filter((path) => before.get(path) !== after.get(path));
}

function unsettled(changed: ReadonlySet<string>): SetupFailure {
	const paths = [...changed].sort((left, right) => left.localeCompare(right));
	const stopped = `Biome still rewrote files after ${MAX_FIX_ROUNDS} rounds, so quality fix stopped.`;
	const named =
		paths.length > 0
			? [`${stopped} These files changed in the last round:`, ...paths.map((path) => `  ${path}`)]
			: [
					`${stopped} The files it changed in the last round are ones quality fix does not read, such as files .gitignore lists.`,
					"Run `biome check --write --unsafe --verbose` to name them.",
				];
	return new SetupFailure({
		message: [...named, "Two fixes probably undo each other there. Fix the code by hand, or turn off one of the rules."].join("\n"),
	});
}

export function settle<Failure, Requirements>({
	passes,
	snapshot,
}: Settling<Failure, Requirements>): Effect.Effect<void, Failure | SetupFailure, Requirements> {
	return Effect.gen(function* () {
		for (let index = 1; index < MAX_FIX_ROUNDS; index += 1) {
			if ((yield* round(passes, index, Effect.void)) === 0) {
				return;
			}
		}
		const changed = new Set<string>();
		let previous = yield* snapshot;
		const record = Effect.map(snapshot, (current) => {
			for (const path of changedBetween(previous, current)) {
				changed.add(path);
			}
			previous = current;
		});
		if ((yield* round(passes, MAX_FIX_ROUNDS, record)) === 0) {
			return;
		}
		return yield* unsettled(changed);
	});
}

export function fix(cwd: string, config: string | undefined): Effect.Effect<void, SetupFailure, FileSystem.FileSystem> {
	return Effect.gen(function* () {
		const { root } = yield* loadConfig(cwd, config);
		const sorted = yield* Effect.mapError(sortManifests(root), (failure) => new SetupFailure({ message: failure.message }));
		yield* Console.log(`quality: sort-package-json rewrote ${plural(sorted, "manifest")}.`);
		yield* settle({ passes: biomePasses(root), snapshot: snapshotOf(root) });
	});
}
