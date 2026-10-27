import { Effect, Option } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { PartialRow } from "#test/partialConflicts.ts";
import { hasPartialConflicts } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it("partial-index conflict ignores keep rows outside the predicate", [hasPartialConflicts()], function* ({ partialConflicts }) {
	const { rows, observe, statements } = partialConflicts();
	const input = { a: "one", b: 1, kind: "X", value: 10 };
	const original = Option.getOrThrow(yield* observe(rows.insertOrIgnore(input)));
	expect(statements[0]?.[0]).toMatch(/on conflict .* where "kind" = \$\d+ do nothing/u);
	expect(statements[0]?.[1].at(-1)).toBe("x");
	expect(yield* rows.insertOrIgnore({ ...input, value: 20 })).toEqual(Option.none());
	const outside = Option.getOrThrow(yield* rows.insertOrIgnore({ ...input, kind: "Y" }));
	expect(outside.id).not.toBe(original.id);
	const inserted = yield* rows.insertManyOrIgnore([input, { ...input, kind: "Y" }, { ...input, a: "two" }]);
	expect(inserted.map(({ a, kind }) => ({ a, kind }))).toEqual([
		{ a: "one", kind: "Y" },
		{ a: "two", kind: "X" },
	]);
	expect(yield* rows.findById(original.id)).toEqual(original);
	expect(yield* rows.findMany({ orderBy: { direction: "asc", field: "id" }, where: { a: "one" } })).toEqual([original, outside, inserted[0]]);
});

postgres.it("partial-index upserts update matches and insert rows outside the predicate", [hasPartialConflicts()], function* ({ partialConflicts }) {
	const { rows } = partialConflicts();
	const input = { a: "one", b: 1, kind: "X", value: 10 };
	const original = yield* rows.upsert(input, { updateColumns: ["value"] });
	expect(yield* rows.upsert({ ...input, value: 20 }, { updateColumns: ["value"] })).toEqual({ ...original, value: 20 });
	const outside = yield* rows.upsert({ ...input, kind: "Y" }, { updateColumns: ["value"] });
	expect(outside.id).not.toBe(original.id);
	const updated = yield* rows.upsertMany(
		[
			{ ...input, value: 30 },
			{ ...input, kind: "Y", value: 40 },
		],
		{ updateColumns: ["value"] },
	);
	expect(updated[0]).toEqual({ ...original, value: 30 });
	expect(updated[1]).toMatchObject({ ...input, kind: "Y", value: 40 });
	expect(updated[1]?.id).not.toBe(outside.id);
	expect(yield* rows.findById(original.id)).toEqual(updated[0]);
	expect(yield* rows.findById(outside.id)).toEqual(outside);
});

postgres.it(
	"an unmatched partial-index target fails in the typed SQL error channel",
	[hasPartialConflicts()],
	function* ({ partialConflicts, makeRepository }) {
		const { options, rows, observe, statements } = partialConflicts();
		const unmatched = yield* makeRepository(PartialRow, { ...options, conflictWhere: { kind: "y' or true --" } });
		const input = { a: "one", b: 1, kind: "X", value: 10 };
		const original = Option.getOrThrow(yield* rows.insertOrIgnore(input));
		for (const write of [
			unmatched.insertOrIgnore(input).pipe(Effect.asVoid),
			unmatched.insertManyOrIgnore([input]).pipe(Effect.asVoid),
			unmatched.upsert(input, { updateColumns: ["value"] }).pipe(Effect.asVoid),
			unmatched.upsertMany([input], { updateColumns: ["value"] }).pipe(Effect.asVoid),
		]) {
			const failure = yield* observe(write).pipe(Effect.flip);
			expect(failure).toBeInstanceOf(SqlError);
			expect(failure).toMatchObject({ reason: { cause: { code: "42P10" } } });
			expect(statements.at(-1)?.[0]).not.toContain("y' or true --");
			expect(statements.at(-1)?.[1].at(-1)).toBe("y' or true --");
		}
		expect(yield* rows.findMany()).toEqual([original]);
	},
);
