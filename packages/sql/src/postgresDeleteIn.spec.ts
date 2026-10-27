import { BigDecimal, Effect } from "effect";
import { expect } from "vitest";
import { input } from "#test/postgresCodecs.ts";
import { hasArraySamples, hasCompositeLedger } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasPayments } from "#test/sqlTraits.ts";

postgres.it("delete matches a list of IDs together with array equality", [hasArraySamples()], function* ({ arraySamples }) {
	const { samples } = arraySamples();
	yield* samples.insertMany([
		{ id: 1, values: [10] },
		{ id: 2, values: [20] },
		{ id: 3, values: [10] },
		{ id: 4, values: [10] },
	]);
	yield* samples.delete({ id: { in: [1, 2, 3] }, values: [10] });
	expect(yield* samples.findMany({ orderBy: { direction: "asc", field: "id" } })).toEqual([
		{ id: 2, values: [20] },
		{ id: 4, values: [10] },
	]);
});

postgres.it("delete with an empty list leaves every row intact", [hasArraySamples()], function* ({ arraySamples, watchChanges }) {
	const { samples, tableName } = arraySamples();
	yield* samples.insert({ id: 1, values: [] });
	const delivered = yield* watchChanges([tableName, `${tableName}:1`]);
	yield* samples.delete({ id: { in: [] } });
	expect(yield* samples.findMany()).toEqual([{ id: 1, values: [] }]);
	expect(delivered).toEqual([]);
});

postgres.it("delete encodes each list entry with the field codec", [hasPayments()], function* ({ paymentFixture }) {
	const { payments } = paymentFixture();
	const first = yield* payments.insert(input);
	const second = yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("42.125") });
	const kept = yield* payments.insert({ ...input, amount: BigDecimal.fromStringUnsafe("99.5") });
	yield* payments.delete({ amount: { in: [first.amount, second.amount] }, note: null });
	expect(yield* payments.findMany({ select: ["id"] })).toEqual([{ id: kept.id }]);
});

postgres.it("composite repositories combine key equality with a list filter", [hasCompositeLedger()], function* ({ compositeLedger, watchChanges }) {
	const { entries, tableName } = compositeLedger();
	yield* entries.insertMany([
		{ account: "a", amount: "10", sequence: 1n },
		{ account: "a", amount: "20", sequence: 2n },
		{ account: "b", amount: "30", sequence: 1n },
	]);
	const deletedKey = `${tableName}:${JSON.stringify(["a", "1"])}`;
	const delivered = yield* watchChanges([tableName, deletedKey]);
	yield* entries.delete({ account: "a", sequence: { in: [1n, 3n] } });
	expect(yield* entries.findMany({ orderBy: { direction: "asc", field: "account" } })).toEqual([
		{ account: "a", amount: "20", sequence: 2n },
		{ account: "b", amount: "30", sequence: 1n },
	]);
	expect(delivered).toEqual([tableName, deletedKey]);
	yield* entries.delete({ account: "a" });
	expect(yield* entries.findMany()).toEqual([{ account: "b", amount: "30", sequence: 1n }]);
});

postgres.it(
	"list deletes announce only deleted keys after the outer commit",
	[hasArraySamples()],
	function* ({ arraySamples, transact, watchChanges }) {
		const { samples, tableName } = arraySamples();
		yield* samples.insertMany([1, 2, 3].map((id) => ({ id, values: [] })));
		const delivered = yield* watchChanges([tableName, ...[1, 2, 3, 99].map((id) => `${tableName}:${id}`)]);
		yield* Effect.gen(function* () {
			yield* samples.delete({ id: { in: [1, 3, 99] } }).pipe(transact({ onSqlError: (error) => error }));
			expect(yield* samples.findMany({ select: ["id"] })).toEqual([{ id: 2 }]);
			expect(delivered).toEqual([]);
		}).pipe(transact({ onSqlError: (error) => error }));
		expect(delivered).toEqual([tableName, `${tableName}:1`, `${tableName}:3`]);
		expect(yield* samples.findMany({ select: ["id"] })).toEqual([{ id: 2 }]);
	},
);

postgres.it(
	"rolled-back list deletes keep their rows and publish no changes",
	[hasArraySamples()],
	function* ({ arraySamples, transact, watchChanges }) {
		const { samples, tableName } = arraySamples();
		yield* samples.insertMany([1, 2].map((id) => ({ id, values: [] })));
		const delivered = yield* watchChanges([tableName, `${tableName}:1`, `${tableName}:2`]);
		const result = yield* samples
			.delete({ id: { in: [1, 2] } })
			.pipe(Effect.andThen(Effect.fail("rollback")), transact({ onSqlError: (error) => error }), Effect.result);
		expect(result).toMatchObject({ _tag: "Failure", failure: "rollback" });
		expect(yield* samples.findMany({ orderBy: { direction: "asc", field: "id" }, select: ["id"] })).toEqual([{ id: 1 }, { id: 2 }]);
		expect(delivered).toEqual([]);
	},
);
