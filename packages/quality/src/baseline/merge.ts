import { Effect, FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline, encodeBaseline } from "#baseline/format.ts";
import { validOrFail } from "#decoded.ts";
import { keyOf } from "#engine/violation.ts";
import { SetupFailure } from "#failure.ts";

// A split entry merges each half on its own; when either side has not recorded the split, the totals merge as before.
function merged(a: BaselineEntry, b: BaselineEntry): readonly BaselineEntry[] {
	const { deep: _recorded, ...entry } = a;
	if (a.deep === undefined || b.deep === undefined) {
		return [{ ...entry, count: Math.min(a.count, b.count) }];
	}
	const deep = Math.min(a.deep, b.deep);
	const count = Math.min(a.count - a.deep, b.count - b.deep) + deep;
	return count === 0 ? [] : [{ ...entry, count, deep }];
}

function mergeEntries(base: readonly BaselineEntry[], ours: readonly BaselineEntry[], theirs: readonly BaselineEntry[]): readonly BaselineEntry[] {
	const original = new Set(base.map((entry) => keyOf(entry.rule, entry.file)));
	const left = new Map(ours.map((entry) => [keyOf(entry.rule, entry.file), entry]));
	const right = new Map(theirs.map((entry) => [keyOf(entry.rule, entry.file), entry]));
	return [...new Set([...left.keys(), ...right.keys()])].flatMap((key) => {
		const a = left.get(key);
		const b = right.get(key);
		if (original.has(key) && (a === undefined || b === undefined)) {
			return [];
		}
		if (a !== undefined && b !== undefined) {
			return merged(a, b);
		}
		const entry = a ?? b;
		return entry === undefined ? [] : [entry];
	});
}

export const mergeBaseline = Effect.fn("Baseline.mergeBaseline")(
	function* (base: string, ours: string, theirs: string) {
		const fs = yield* FileSystem.FileSystem;
		const entries = yield* Effect.forEach([base, ours, theirs], (path) =>
			Effect.gen(function* () {
				const raw = yield* fs.readFileString(path);
				return yield* validOrFail(path, decodeBaseline(raw));
			}),
		);
		yield* fs.writeFileString(ours, encodeBaseline(mergeEntries(entries[0] ?? [], entries[1] ?? [], entries[2] ?? [])));
	},
	Effect.mapError((failure) => new SetupFailure({ cause: failure, message: failure.message })),
);
