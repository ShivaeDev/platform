import { expect } from "vitest";
import { PartialRow } from "#test/partialConflicts.ts";
import { hasPartialConflicts } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { tupleIn } from "#tupleIn.ts";

postgres.it(
	"large tuple lists reach PostgreSQL as bound parameters in reads, selects and deletes",
	[hasPartialConflicts()],
	function* ({ partialConflicts, sql }) {
		const { rows, observe, statements } = partialConflicts();
		const quoted = "one') OR true --";
		yield* rows.insertMany([
			{ a: quoted, b: 1, kind: "X", value: 10 },
			{ a: "other", b: 1, kind: "X", value: 20 },
		]);
		const listSize = 10_000;
		const tuples = Array.from({ length: listSize }, (_, index): readonly [string, number] => [
			index === listSize - 1 ? quoted : `missing-${index}`,
			1,
		]);
		const where = tupleIn(PartialRow, ["a", "b"], tuples);
		expect(yield* observe(rows.findMany({ select: ["a", "b"], where }))).toEqual([{ a: quoted, b: 1 }]);
		const selected = yield* rows.select({ select: ["a"], where }).statement;
		expect(yield* observe(sql`${selected}`)).toEqual([{ a: quoted }]);
		yield* observe(rows.delete(where));
		expect(yield* rows.findMany({ select: ["a"] })).toEqual([{ a: "other" }]);
		expect(statements.map(([query]) => query)).toEqual([
			expect.stringMatching(/^select/u),
			expect.stringMatching(/^select/u),
			expect.stringMatching(/^delete/u),
		]);
		for (const [query, parameters] of statements) {
			expect(parameters).toEqual(tuples.flatMap(([a, b]) => [a, String(b)]));
			expect(query).not.toContain(quoted);
		}
	},
);
