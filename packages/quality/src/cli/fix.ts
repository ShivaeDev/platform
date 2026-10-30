import { relative } from "node:path";
import { Console, Effect, FileSystem } from "effect";
import { biomeReport } from "#biome/report.ts";
import { loadConfig } from "#config/load.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { SetupFailure } from "#failure.ts";
import { posix } from "#inventory/ignoreScope.ts";
import { walk } from "#inventory/walk.ts";
import { sortManifests } from "#manifests/sorted.ts";
import { plural } from "#report/plural.ts";
import type { RuleServices } from "#rule.ts";

export const MAX_FIX_ROUNDS = 5;

function isBinary(bytes: Uint8Array): boolean {
	return bytes.includes(0);
}

export function snapshotOf(root: string): Effect.Effect<ReadonlyMap<string, string>, SetupFailure, RuleServices> {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const decoder = new TextDecoder();
		const paths = yield* walk(root);
		const texts = yield* Effect.forEach(paths, (path) =>
			Effect.map(fs.readFile(path), (bytes) => (isBinary(bytes) ? [] : [[posix(relative(root, path)), decoder.decode(bytes)] as const])),
		);
		return new Map(texts.flat());
	}).pipe(Effect.mapError((failure) => new SetupFailure({ cause: failure, message: failure.message })));
}

export interface Pass<TFailure, TRequirements> {
	readonly label: string;
	readonly run: Effect.Effect<number, TFailure, TRequirements>;
}

export interface Settling<TFailure, TRequirements> {
	readonly passes: readonly Pass<TFailure, TRequirements>[];
	readonly snapshot: Effect.Effect<ReadonlyMap<string, string>, TFailure, TRequirements>;
}

function changedBy(
	root: string,
	args: readonly string[],
	exceptions: readonly ExceptionDeclaration[],
): Effect.Effect<number, SetupFailure, RuleServices> {
	return Effect.map(
		biomeReport(root, args, exceptions).pipe(Effect.mapError((cause) => new SetupFailure({ cause, message: cause.message }))),
		(report) => report.summary.changed,
	);
}

function biomePasses(root: string, exceptions: readonly ExceptionDeclaration[]): readonly Pass<SetupFailure, RuleServices>[] {
	return [
		{
			label: "with fixes",
			run: changedBy(
				root,
				["check", "--write", "--unsafe", "--skip=assist/source/useSortedKeys", "--skip=lint/suspicious/noDuplicateObjectKeys"],
				exceptions,
			),
		},
		{ label: "with the format pass", run: changedBy(root, ["format", "--write"], exceptions) },
	];
}

const round = Effect.fn("Cli.round")(function* <TFailure, TRequirements>(
	passes: readonly Pass<TFailure, TRequirements>[],
	index: number,
	afterEachPass: Effect.Effect<void, TFailure, TRequirements>,
): Effect.fn.Return<number, TFailure, TRequirements> {
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
		message: [...named, "Two fixes probably undo each other there. Repair the conflicting code by hand so both checks pass."].join("\n"),
	});
}

export const settle = Effect.fn("Cli.settle")(function* <TFailure, TRequirements>({
	passes,
	snapshot,
}: Settling<TFailure, TRequirements>): Effect.fn.Return<void, TFailure | SetupFailure, TRequirements> {
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

export const fix = Effect.fn("Cli.fix")(function* (cwd: string, config: string | undefined): Effect.fn.Return<void, SetupFailure, RuleServices> {
	const { root, exceptions } = yield* loadConfig(cwd, config);
	const sorted = yield* Effect.mapError(sortManifests(root), (failure) => new SetupFailure({ cause: failure, message: failure.message }));
	yield* Console.log(`quality: sort-package-json rewrote ${plural(sorted, "manifest")}.`);
	yield* settle({ passes: biomePasses(root, exceptions), snapshot: snapshotOf(root) });
});
