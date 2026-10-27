import { Effect, Option } from "effect";
import { expect } from "vitest";
import { mapped } from "#test/clientNames.ts";
import { Reading } from "#test/compositeReadings.ts";
import { hasCompositeReadings } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { transaction } from "#test/transaction.ts";

postgres.it(
	"PostgreSQL composite keys support idempotent ingest and isolate full-key CRUD",
	[hasCompositeReadings()],
	function* ({ sql, compositeReadings }) {
		const { readings, tableName } = compositeReadings();
		const input = { amount: 52, label: "original", sequence: 1, source: "meter" };
		const original = yield* readings.insert(input);
		expect(original).toBeInstanceOf(Reading);
		yield* readings.insertVoid({ ...input, sequence: 2 });
		yield* readings.insert({ ...input, source: "other" });
		expect(yield* readings.findById({ sequence: 1, source: "meter" })).toEqual(original);
		expect(yield* readings.insertOrIgnore({ ...input, amount: 99 })).toEqual(Option.none());
		expect(yield* readings.findById({ sequence: 1, source: "meter" })).toEqual(original);
		const incompleteKey: { source: string; sequence: number } = JSON.parse('{"source":"meter"}');
		expect(yield* readings.findById(incompleteKey).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
		const fresh = yield* readings.insertOrIgnore({ ...input, sequence: 3 });
		expect(Option.getOrThrow(fresh)).toBeInstanceOf(Reading);
		const updated = yield* readings.upsert({ ...input, amount: 60, label: "ignored" }, { updateColumns: ["amount"] });
		expect(updated.row).toBeInstanceOf(Reading);
		expect(updated).toEqual({ inserted: false, row: { ...input, amount: 60 } });
		expect(yield* sql`select amount from ${sql(tableName)} where source = 'meter' and sequence = '1'`).toEqual([{ amount: "60" }]);
		expect(yield* readings.upsert({ ...input, sequence: 4 }, { updateColumns: ["amount"] })).toEqual({
			inserted: true,
			row: { ...input, sequence: 4 },
		});
		yield* readings.updateVoid({ ...input, amount: 70, sequence: 2 });
		expect(yield* readings.update({ ...input, amount: 80, sequence: 2 })).toEqual({ ...input, amount: 80, sequence: 2 });
		expect(yield* readings.findById({ sequence: 1, source: "other" })).toMatchObject({ amount: input.amount });
		yield* readings.delete({ sequence: 1, source: "meter" });
		expect(yield* readings.findById({ sequence: 2, source: "meter" })).toEqual({ ...input, amount: 80, sequence: 2 });
		expect(yield* readings.findById({ sequence: 1, source: "meter" }).pipe(Effect.flip)).toMatchObject({ _tag: "NoSuchElementError" });
		yield* readings.delete({ sequence: 1, source: "meter" });
		const rollback = yield* transaction(
			Effect.gen(function* () {
				yield* readings.upsert({ ...input, amount: 100, sequence: 2 }, { updateColumns: ["amount"] });
				yield* readings.insertOrIgnore({ ...input, sequence: 5 });
				return yield* Effect.fail("cancelled");
			}),
		).pipe(Effect.result);
		expect(rollback._tag).toBe("Failure");
		expect(yield* readings.findById({ sequence: 2, source: "meter" })).toEqual({ ...input, amount: 80, sequence: 2 });
		expect(yield* readings.findMany({ where: { sequence: 5 } })).toEqual([]);
	},
);

mapped.it("upserts report insert then update for the same key, including mixed batches", [], function* ({ rows }) {
	const original = { createdAt: new Date("2026-10-25T12:00:00Z"), id: 1 };
	const newer = { ...original, createdAt: new Date("2026-10-25T13:00:00Z") };
	const settings = { updateColumns: ["createdAt"] } as const;
	expect(yield* rows.upsert(original, settings)).toEqual({ inserted: true, row: original });
	expect(yield* rows.upsert(newer, settings)).toEqual({ inserted: false, row: newer });
	expect(yield* rows.upsertMany([original, { ...newer, id: 2 }], settings)).toEqual([
		{ inserted: false, row: original },
		{ inserted: true, row: { ...newer, id: 2 } },
	]);
	expect(yield* rows.findMany({ orderBy: { direction: "asc", field: "id" } })).toEqual([original, { ...newer, id: 2 }]);
});
