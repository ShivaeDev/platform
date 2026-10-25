import { Effect, Option, Result } from "effect";
import { expect } from "vitest";
import { OwnedRow } from "#test/postgresOwnedRows.ts";
import { postgres } from "#test/sqlStory.ts";
import { hasOwnedRows } from "#test/sqlTraits.ts";

postgres.it("an owner's key cannot read or change another owner's row", [hasOwnedRows()], function* ({ ownedRows, captureStatement }) {
	const { rows, tableName } = ownedRows();
	const missing = yield* rows.update({ id: 1, lockVersion: 0, name: "A's edit", ownerId: 1 }).pipe(Effect.flip);
	const original = yield* rows.insert({ id: 1, name: "B's draft", ownerId: 2 });
	const foreign = { ...original, ownerId: 1 };
	expect(yield* rows.findById(foreign).pipe(Effect.flip)).toMatchObject({ _tag: "NoSuchElementError" });
	const update = yield* captureStatement(rows.update({ ...foreign, name: "A's edit" }).pipe(Effect.flip));
	const updateVoid = yield* rows.updateVoid({ ...foreign, name: "A's edit" }).pipe(Effect.flip);
	const remove = yield* rows.delete(foreign, 0).pipe(Effect.flip);
	const fields = { _tag: "OptimisticConcurrencyError", expectedVersion: 0, id: { id: 1, ownerId: 1 }, reason: "missing", tableName };
	for (const failure of [update.rows, updateVoid, remove]) {
		expect({ ...failure }).toEqual(fields);
	}
	expect({ ...missing }).toEqual(fields);
	expect(update.statements.filter(([query]) => /^(?:update|select)/u.test(query)).map(([query]) => query)).toEqual([
		expect.stringMatching(/update .* where .*"id" = .*"ownerId" = .*"lockVersion" = .* returning \*/u),
		expect.stringMatching(/select 1 .* where .*"id" = .*"ownerId" =/u),
	]);
	expect(yield* rows.findById(original)).toEqual(original);
});

postgres.it(
	"composite updates decode RETURNING and stale writes preserve the winner",
	[hasOwnedRows()],
	function* ({ ownedRows, sql, captureStatement }) {
		const { rows, tableName } = ownedRows();
		const original = yield* rows.insert({ id: 1, name: "Draft", ownerId: 2 });
		const write = yield* captureStatement(rows.update({ ...original, name: "Published" }));
		expect(write.rows).toBeInstanceOf(OwnedRow);
		expect(write.rows).toEqual({ ...original, lockVersion: 1, name: "Published" });
		expect(write.statements.filter(([query]) => /^(?:update|select)/u.test(query)).map(([query]) => query)).toEqual([
			expect.stringMatching(/^update .*"lockVersion" = "lockVersion" \+ 1 where .*"id" = .*"ownerId" = .*"lockVersion" = .* returning \*$/u),
		]);
		const stale = yield* rows.update({ ...original, name: "Lost" }).pipe(Effect.flip);
		expect(stale).toMatchObject({ expectedVersion: 0, id: { id: 1, ownerId: 2 }, reason: "stale", tableName });
		expect(yield* rows.updateVoid(original).pipe(Effect.flip)).toMatchObject({ reason: "stale" });
		expect(yield* rows.delete(original, 0).pipe(Effect.flip)).toMatchObject({ reason: "stale" });
		expect(yield* rows.findById(original)).toEqual(write.rows);
		expect(yield* sql`select * from ${sql(tableName)}`).toEqual([{ id: "1", lockVersion: 1, name: "Published", ownerId: "2" }]);
		yield* rows.updateVoid({ ...write.rows, name: "Final" });
		expect(yield* rows.findById(original)).toEqual({ ...original, lockVersion: 2, name: "Final" });
		yield* rows.delete(original, 2);
		expect(yield* rows.findMany()).toEqual([]);
	},
);

postgres.it("concurrent composite writers have one winner and one stale conflict", [hasOwnedRows()], function* ({ ownedRows }) {
	const { rows } = ownedRows();
	const original = yield* rows.insert({ id: 1, name: "Draft", ownerId: 2 });
	const readers = yield* Effect.all([rows.findById(original), rows.findById(original)], { concurrency: 2 });
	const outcomes = yield* Effect.forEach(readers, (read, index) => rows.update({ ...read, name: `Writer ${index}` }).pipe(Effect.result), {
		concurrency: 2,
	});
	const winners = outcomes.filter(Result.isSuccess);
	const losers = outcomes.filter(Result.isFailure);
	expect(winners.map(({ success }) => success)).toEqual([{ ...original, lockVersion: 1, name: expect.stringMatching(/^Writer [01]$/u) }]);
	expect(losers.map(({ failure }) => failure)).toEqual([expect.objectContaining({ id: { id: 1, ownerId: 2 }, reason: "stale" })]);
	expect(yield* rows.findById(original)).toEqual(winners[0]?.success);
});

postgres.it("versioned insertOrIgnore never returns or changes a conflicting owner's row", [hasOwnedRows()], function* ({ ownedRows }) {
	const { rows } = ownedRows();
	const original = yield* rows.insertOrIgnore({ id: 1, name: "B's draft", ownerId: 2 });
	expect(Option.getOrThrow(original)).toEqual({ id: 1, lockVersion: 0, name: "B's draft", ownerId: 2 });
	expect(yield* rows.insertOrIgnore({ id: 1, name: "A's replacement", ownerId: 1 })).toEqual(Option.none());
	expect(yield* rows.insertOrIgnore({ id: 1, name: "B's retry", ownerId: 2 })).toEqual(Option.none());
	expect(yield* rows.findById({ id: 1, ownerId: 2 })).toEqual(Option.getOrThrow(original));
});

postgres.it("versioned insertOrIgnore supports a partial conflict target", [hasOwnedRows()], function* ({ ownedRows }) {
	const { activeRows } = ownedRows();
	const original = yield* activeRows.insertOrIgnore({ id: 1, name: "Active", ownerId: 2 });
	expect(Option.getOrThrow(original)).toMatchObject({ id: 1, lockVersion: 0 });
	expect(yield* activeRows.insertOrIgnore({ id: 2, name: "Active", ownerId: 2 })).toEqual(Option.none());
	expect(Option.getOrThrow(yield* activeRows.insertOrIgnore({ id: 3, name: "Draft", ownerId: 2 }))).toMatchObject({ id: 3, lockVersion: 0 });
	expect(yield* activeRows.findById({ id: 1, ownerId: 2 })).toEqual(Option.getOrThrow(original));
});

postgres.it("composite versioned writes retain their repository spans", [hasOwnedRows()], function* ({ ownedRows, recordSpans }) {
	const { rows } = ownedRows();
	const { spans, observe } = recordSpans();
	const original = yield* rows.insert({ id: 1, name: "Draft", ownerId: 2 });
	const updated = yield* observe(rows.update({ ...original, name: "Published" }));
	yield* observe(rows.updateVoid({ ...updated, name: "Final" }));
	yield* observe(rows.delete(original, 2));
	expect(spans.filter((span) => span.name.startsWith("OwnedRow.")).map((span) => [span.name, span.status._tag])).toEqual([
		["OwnedRow.update", "Ended"],
		["OwnedRow.updateVoid", "Ended"],
		["OwnedRow.delete", "Ended"],
	]);
});

postgres.it("composite writes encode both key fields and the version field", [hasOwnedRows()], function* ({ ownedRows }) {
	const { codedRows } = ownedRows();
	const original = yield* codedRows.insert({ id: 1, name: "Draft", ownerId: 2 });
	const updated = yield* codedRows.update({ ...original, name: "Published" });
	expect(updated).toEqual({ ...original, lockVersion: 2, name: "Published" });
	yield* codedRows.updateVoid({ ...updated, name: "Final" });
	expect(yield* codedRows.findById(original)).toEqual({ ...original, lockVersion: 4, name: "Final" });
	expect(yield* codedRows.delete(original, 2).pipe(Effect.flip)).toMatchObject({ reason: "stale" });
	yield* codedRows.delete(original, 4);
	expect(yield* codedRows.findMany()).toEqual([]);
});
