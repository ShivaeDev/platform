import { Effect } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { inputs, Reading } from "#test/postgresBatch.ts";
import { hasWideRows } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasBatchReadings } from "#test/sqlTraits.ts";

postgres.it(
	"PostgreSQL batch ignores conflicts, preserves defaults and writes one statement per chunk",
	[hasBatchReadings()],
	function* ({ batchFixture }) {
		const { readings, count, statements } = batchFixture();
		const batch = inputs(1001).map((row, index) => {
			if (index === 1) {
				return { ...row, note: "present" };
			}
			if (index === 2) {
				return { ...row, note: null };
			}
			return row;
		});
		const inserted = yield* readings.insertManyOrIgnore(batch);
		expect(inserted).toHaveLength(batch.length);
		expect(inserted.every((row) => row instanceof Reading)).toBe(true);
		expect(inserted[0]).toMatchObject({ amount: 0, id: 1, note: "default note", source: "meter-0" });
		expect(inserted[1]?.note).toBe("present");
		expect(inserted[2]?.note).toBeNull();
		expect(yield* statements).toEqual([1000, 1]);
		expect(yield* readings.insertManyOrIgnore(batch)).toEqual([]);
		expect(yield* count).toBe(batch.length);
		expect(yield* statements).toEqual([1000, 1, 0, 0]);
	},
);

postgres.it("PostgreSQL batch upserts update only selected columns and insert new rows", [hasBatchReadings()], function* ({ batchFixture }) {
	const { readings, statements } = batchFixture();
	const batch = inputs(1001);
	yield* readings.insertMany(batch);
	const updated = yield* readings.upsertMany(
		[...batch.map((row) => ({ ...row, amount: row.amount + 10, label: "ignored" })), { amount: 5, label: "new", source: "new" }],
		{ updateColumns: ["amount"] },
	);
	expect(updated).toHaveLength(1002);
	expect(updated.every((row) => row instanceof Reading)).toBe(true);
	expect(updated[0]).toMatchObject({ amount: 10, label: "original", source: "meter-0" });
	expect(updated[1000]).toMatchObject({ amount: 1010, label: "original", source: "meter-1000" });
	expect(updated[1001]).toMatchObject({ amount: 5, label: "new", source: "new" });
	expect(yield* statements).toEqual([1000, 1, 0, 1]);
	expect((yield* readings.findMany({ where: { source: "meter-1000" } }))[0]).toMatchObject({ amount: 1010, label: "original" });
});

postgres.it(
	"a later PostgreSQL batch failure rolls back earlier chunks without a caller transaction",
	[hasBatchReadings()],
	function* ({ batchFixture, sql }) {
		const { readings, plain, count, statements, calls } = batchFixture();
		const batch = [...inputs(1000), { amount: -1, label: "invalid", source: "invalid" }];
		for (const write of [
			() => plain.insertMany(batch),
			() => readings.insertManyOrIgnore(batch),
			() => readings.upsertMany(batch, { updateColumns: ["amount"] }),
		]) {
			const failure = yield* write().pipe(Effect.flip);
			expect(failure).toBeInstanceOf(SqlError);
			expect(yield* count).toBe(0);
			expect(yield* statements).toEqual([]);
		}
		expect(yield* sql`select last_value::int as calls from ${sql(calls)}`).toEqual([{ calls: 3 }]);
	},
);

postgres.it("empty PostgreSQL batches return no rows and execute no write statements", [hasBatchReadings()], function* ({ batchFixture }) {
	const { readings, plain, statements } = batchFixture();
	expect(yield* plain.insertMany([])).toEqual([]);
	expect(yield* readings.insertManyOrIgnore([])).toEqual([]);
	expect(yield* readings.upsertMany([], { updateColumns: ["amount"] })).toEqual([]);
	expect(yield* statements).toEqual([]);
	const inserted = yield* plain.insertMany(inputs(2));
	expect(inserted.map((row) => row.amount)).toEqual([0, 1]);
	expect(yield* statements).toEqual([2]);
});

postgres.it("wide PostgreSQL batches stay under the bind limit before reaching the row cap", [hasWideRows()], function* ({ wideRows }) {
	const { repository, values } = wideRows();
	const inserted = yield* repository.insertMany(Array.from({ length: 1001 }, (_, id) => ({ ...values, id })));
	expect(inserted).toHaveLength(1001);
	expect(yield* repository.findById(1000)).toEqual({ ...values, id: 1000 });
});
