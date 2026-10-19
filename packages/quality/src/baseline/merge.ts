import { Effect, FileSystem } from "effect";
import { type BaselineEntry, decodeBaseline, encodeBaseline } from "#baseline/format.ts";
import { validOrFail } from "#decoded.ts";
import { keyOf } from "#engine/violation.ts";
import { SetupFailure } from "#failure.ts";

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
		const entry = a ?? b;
		return entry === undefined ? [] : [{ ...entry, count: Math.min(a?.count ?? entry.count, b?.count ?? entry.count) }];
	});
}

export const mergeBaseline = Effect.fn("Baseline.mergeBaseline")(
	function* (base: string, ours: string, theirs: string) {
		const fs = yield* FileSystem.FileSystem;
		const entries = yield* Effect.forEach([base, ours, theirs], (path) =>
			Effect.gen(function* () {
				const raw = yield* fs.readFileString(path);
				return yield* validOrFail(path, yield* Effect.promise(() => decodeBaseline(raw)));
			}),
		);
		yield* fs.writeFileString(ours, encodeBaseline(mergeEntries(entries[0] ?? [], entries[1] ?? [], entries[2] ?? [])));
	},
	Effect.mapError((failure) => new SetupFailure({ message: failure.message })),
);
