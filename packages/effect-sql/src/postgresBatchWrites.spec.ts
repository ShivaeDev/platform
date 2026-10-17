import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { makeRepository } from "#repository.ts";
import { integration, runPostgres } from "#test/postgres-transact.ts";
import { inputs, Reading, setupBatch } from "#test/postgresBatch.ts";

function runBatch<A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) {
	return runPostgres(Effect.flatMap(SqlClient.SqlClient, (sql) => sql.withTransaction(effect)));
}

integration("PostgreSQL batch ignores conflicts, preserves defaults and writes one statement per chunk", async () => {
	await runBatch(
		Effect.gen(function* () {
			const { readings, count, statements } = yield* setupBatch;
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
		}),
	);
});

integration("PostgreSQL batch upserts update only selected columns and insert new rows", async () => {
	await runBatch(
		Effect.gen(function* () {
			const { readings, statements } = yield* setupBatch;
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
		}),
	);
});

integration("a later PostgreSQL batch failure rolls back earlier chunks in the native transaction", async () => {
	await runBatch(
		Effect.gen(function* () {
			const { readings, plain, count, statements, calls, sql } = yield* setupBatch;
			const batch = [...inputs(1000), { amount: -1, label: "invalid", source: "invalid" }];
			for (const write of [
				() => plain.insertMany(batch),
				() => readings.insertManyOrIgnore(batch),
				() => readings.upsertMany(batch, { updateColumns: ["amount"] }),
			]) {
				const failure = yield* sql.withTransaction(write()).pipe(Effect.flip);
				expect(failure).toBeInstanceOf(SqlError);
				expect(yield* count).toBe(0);
				expect(yield* statements).toEqual([]);
			}
			expect(yield* sql`select last_value::int as calls from ${sql(calls)}`).toEqual([{ calls: 3 }]);
		}),
	);
});

integration("empty PostgreSQL batches return no rows and execute no write statements", async () => {
	await runBatch(
		Effect.gen(function* () {
			const { readings, plain, statements } = yield* setupBatch;
			expect(yield* plain.insertMany([])).toEqual([]);
			expect(yield* readings.insertManyOrIgnore([])).toEqual([]);
			expect(yield* readings.upsertMany([], { updateColumns: ["amount"] })).toEqual([]);
			expect(yield* statements).toEqual([]);
			const inserted = yield* plain.insertMany(inputs(2));
			expect(inserted.map((row) => row.amount)).toEqual([0, 1]);
			expect(yield* statements).toEqual([2]);
		}),
	);
});

integration("wide PostgreSQL batches stay under the bind limit before reaching the row cap", async () => {
	await runBatch(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const fields = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [`field${index}`, Schema.Int]));
			class Wide extends Model.Class<Wide>("Wide")({ ...fields, id: Schema.Int }) {}
			const tableName = `batch_wide_${crypto.randomUUID().replaceAll("-", "")}`;
			yield* sql`create temporary table ${sql(tableName)} (id integer primary key, ${sql.csv(Object.keys(fields).map((name) => sql`${sql(name)} integer not null`))}) on commit drop`;
			const repository = yield* makeRepository(Wide, { idColumn: "id", spanPrefix: "Wide", tableName });
			const values = Object.fromEntries(Object.keys(fields).map((key) => [key, 1]));
			const inserted = yield* repository.insertMany(Array.from({ length: 1001 }, (_, id) => ({ ...values, id })));
			expect(inserted).toHaveLength(1001);
			expect(yield* repository.findById(1000)).toEqual({ ...values, id: 1000 });
		}),
	);
});
