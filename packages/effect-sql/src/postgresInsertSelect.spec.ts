import { Effect } from "effect";
import { expect } from "vitest";
import { CopiedRow, columns } from "#test/insertSelect.ts";
import { hasInsertSelectRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"inserts a filtered, ordered projection with mapped columns and decodes returned rows",
	[hasInsertSelectRows()],
	function* ({ insertSelect, sql }) {
		const { source, target, targetTable } = insertSelect();
		const rows = yield* target.insertFromSelect(
			source.select({
				limit: 2,
				orderBy: { direction: "desc", field: "sourceKey" },
				select: ["sourceKey", "displayName", "amount"],
				where: { status: "flaky" },
			}),
			columns,
		);
		for (const row of rows) {
			expect(row).toBeInstanceOf(CopiedRow);
			expect(row.createdAt).toBeInstanceOf(Date);
			expect(row.id).toBeTypeOf("number");
		}
		expect(rows.map(({ amount, copiedKey, name }) => ({ amount, copiedKey, name })).sort((a, b) => a.copiedKey - b.copiedKey)).toEqual([
			{ amount: 20, copiedKey: 2, name: "second" },
			{ amount: 40, copiedKey: 4, name: "fourth" },
		]);
		expect(yield* sql`select amount from ${sql(targetTable)} order by "copiedKey"`).toEqual([{ amount: "20" }, { amount: "40" }]);
	},
);

postgres.it(
	"insert-from-select ignores existing declared keys and returns only inserted rows",
	[hasInsertSelectRows()],
	function* ({ insertSelect }) {
		const { source, target } = insertSelect();
		const original = yield* target.insert({ amount: 99, copiedKey: 2, name: "existing" });
		const rows = yield* target.insertFromSelectOrIgnore(source.select({ where: { status: "flaky" } }), columns);
		expect(rows.map((row) => row.copiedKey).sort()).toEqual([1, 4]);
		expect(rows.every((row) => row instanceof CopiedRow)).toBe(true);
		expect(yield* target.findById(original.id)).toEqual(original);
		expect((yield* target.findMany()).map((row) => row.copiedKey).sort()).toEqual([1, 2, 4]);
	},
);

postgres.it("an empty select inserts no rows with either conflict mode", [hasInsertSelectRows()], function* ({ insertSelect }) {
	const { source, target } = insertSelect();
	const empty = source.select({ where: { status: "missing" } });
	expect(yield* target.insertFromSelect(empty, columns)).toEqual([]);
	expect(yield* target.insertFromSelectOrIgnore(empty, columns)).toEqual([]);
	expect(yield* target.findMany()).toEqual([]);
});

postgres.it("insert-from-select joins transact and rolls back with its caller", [hasInsertSelectRows()], function* ({ insertSelect, transact }) {
	const { source, target } = insertSelect();
	const failure = yield* Effect.gen(function* () {
		const rows = yield* target.insertFromSelect(source.select({ where: { sourceKey: 1 } }), columns);
		expect(rows.map((row) => row.copiedKey)).toEqual([1]);
		expect(yield* target.findMany()).toEqual(rows);
		yield* target.insertFromSelectOrIgnore(source.select({ where: { sourceKey: 2 } }), columns);
		return yield* Effect.fail("cancel copy");
	}).pipe(transact({ onSqlError: (error) => error }), Effect.flip);
	expect(failure).toBe("cancel copy");
	expect(yield* target.findMany()).toEqual([]);
});
