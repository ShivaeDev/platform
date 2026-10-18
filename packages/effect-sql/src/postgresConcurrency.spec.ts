import { Effect, Result } from "effect";
import { expect } from "vitest";
import { OptimisticConcurrencyError } from "#repository.ts";
import { Document } from "#test/postgresVersioned.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasVersionedDocuments } from "#test/sqlTraits.ts";

postgres.it("PostgreSQL inserts initialize versions and updates return the incremented model", [hasVersionedDocuments()], function* ({ versions }) {
	const { documents } = versions();
	const original = yield* documents.insert({ name: "Draft" });
	expect(original.lockVersion).toBe(0);
	const updated = yield* documents.update({ ...original, name: "Published" });
	expect(updated).toBeInstanceOf(Document);
	expect(updated).toEqual({ ...original, lockVersion: 1, name: "Published" });
	expect(yield* documents.findById(original.id)).toEqual(updated);
	const conflict = yield* documents.update({ ...original, name: "Stale" }).pipe(Effect.flip);
	expect(conflict).toBeInstanceOf(OptimisticConcurrencyError);
	expect(yield* documents.findById(original.id)).toEqual(updated);
});

postgres.it("PostgreSQL versioned writes roll back with the caller's transaction", [hasVersionedDocuments()], function* ({ versions, sql }) {
	const { documents } = versions();
	const original = yield* documents.insert({ name: "Draft" });
	const result = yield* sql
		.withTransaction(
			Effect.gen(function* () {
				const updated = yield* documents.update({ ...original, name: "Published" });
				yield* documents.insertVoid({ name: "Temporary" });
				yield* documents.delete(updated.id, updated.lockVersion);
				return yield* Effect.fail("cancelled");
			}),
		)
		.pipe(Effect.result);
	expect(result).toEqual(Result.fail("cancelled"));
	expect(yield* documents.findById(original.id)).toEqual(original);
	expect(yield* documents.findMany({ select: ["lockVersion", "name"] })).toEqual([{ lockVersion: 0, name: "Draft" }]);
});

postgres.it("PostgreSQL concurrent writers produce exactly one winner and one typed conflict", [hasVersionedDocuments()], function* ({ versions }) {
	const { documents, tableName } = versions();
	const original = yield* documents.insert({ name: "Draft" });
	const readers = yield* Effect.all([documents.findById(original.id), documents.findById(original.id)], { concurrency: 2 });
	const outcomes = yield* Effect.forEach(readers, (read, index) => documents.update({ ...read, name: `Writer ${index}` }).pipe(Effect.result), {
		concurrency: 2,
	});
	const winners = outcomes.filter(Result.isSuccess);
	const losers = outcomes.filter(Result.isFailure);
	expect(winners).toHaveLength(1);
	expect(losers).toHaveLength(1);
	expect(losers[0]?.failure).toBeInstanceOf(OptimisticConcurrencyError);
	expect(losers[0]?.failure).toMatchObject({ expectedVersion: 0, id: original.id, tableName });
	expect(winners[0]?.success.lockVersion).toBe(1);
	expect(yield* documents.findById(original.id)).toEqual(winners[0]?.success);
});

postgres.it("PostgreSQL versioned deletes reject stale and missing rows", [hasVersionedDocuments()], function* ({ versions }) {
	const { documents, tableName } = versions();
	const original = yield* documents.insert({ name: "Draft" });
	const updated = yield* documents.update({ ...original, name: "Published" });
	const stale = yield* documents.delete(original.id, original.lockVersion).pipe(Effect.flip);
	expect(stale).toBeInstanceOf(OptimisticConcurrencyError);
	expect(stale).toMatchObject({ expectedVersion: 0, id: original.id, tableName });
	expect(yield* documents.findById(original.id)).toEqual(updated);
	yield* documents.delete(updated.id, updated.lockVersion);
	expect(yield* documents.findMany()).toEqual([]);
	const missing = yield* documents.delete(updated.id, updated.lockVersion).pipe(Effect.flip);
	expect(missing).toBeInstanceOf(OptimisticConcurrencyError);
	const missingUpdate = yield* documents.update(updated).pipe(Effect.flip);
	expect(missingUpdate).toBeInstanceOf(OptimisticConcurrencyError);
});

postgres.it(
	"PostgreSQL void writes initialize and increment versions and reject stale inputs",
	[hasVersionedDocuments()],
	function* ({ versions, sql }) {
		const { documents, tableName } = versions();
		yield* documents.insertVoid({ name: "Draft" });
		const original = yield* documents.findById(1);
		expect(original.lockVersion).toBe(0);
		yield* documents.updateVoid({ ...original, name: "Published" });
		expect(yield* documents.findById(1)).toEqual({ ...original, lockVersion: 1, name: "Published" });
		const stale = yield* documents.updateVoid(original).pipe(Effect.flip);
		expect(stale).toBeInstanceOf(OptimisticConcurrencyError);
		yield* sql`delete from ${sql(tableName)}`;
		const missing = yield* documents.updateVoid({ ...original, lockVersion: 1 }).pipe(Effect.flip);
		expect(missing).toBeInstanceOf(OptimisticConcurrencyError);
	},
);
