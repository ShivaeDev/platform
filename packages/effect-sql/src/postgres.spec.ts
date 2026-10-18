import { Effect } from "effect";
import { expect, expectTypeOf } from "vitest";
import { InvoiceLine } from "#test/invoiceLines.ts";
import { hasPostgresInvoiceLines } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it("PostgreSQL repository preserves model codecs and ambient transactions", [hasPostgresInvoiceLines()], function* ({ sql, invoiceLines }) {
	const { lines, tableName } = invoiceLines();
	const consulting = yield* lines.insert({
		amount: 52,
		name: "Consulting",
		note: null,
	});
	expect(consulting).toBeInstanceOf(InvoiceLine);
	expect(consulting.id).toBe(1);
	expect(consulting.amount).toBe(52);
	expect(yield* sql`select amount from ${sql(tableName)}`).toEqual([{ amount: "52" }]);
	yield* lines.insert({ amount: 57, name: "Hosting", note: "annual" });
	const selected = yield* lines.findMany({
		select: ["name", "amount"],
		where: { amount: 52, note: null },
	});
	expectTypeOf(selected).toEqualTypeOf<Array<{ readonly name: string; readonly amount: number }>>();
	expect(selected).toEqual([{ amount: 52, name: "Consulting" }]);
	expect(
		yield* lines.findMany({
			limit: 1,
			orderBy: { direction: "desc", field: "name" },
			select: ["name"],
		}),
	).toEqual([{ name: "Hosting" }]);
	const rollbackProgram = Effect.gen(function* () {
		yield* lines.insert({
			amount: 1,
			name: "Rollback",
			note: null,
		});
		const inserted = yield* lines.findMany({
			select: ["name"],
			where: { name: "Rollback" },
		});
		expect(inserted).toEqual([{ name: "Rollback" }]);
		return yield* Effect.fail("cancelled");
	});
	const rolledBack = yield* sql.withTransaction(rollbackProgram).pipe(Effect.result);
	expect(rolledBack._tag).toBe("Failure");
	expect(
		yield* lines.findMany({
			orderBy: { direction: "asc", field: "id" },
			select: ["name"],
		}),
	).toEqual([{ name: "Consulting" }, { name: "Hosting" }]);
	const updated = yield* lines.update({
		...consulting,
		amount: 60,
		name: "Revised",
	});
	expect(updated.name).toBe("Revised");
	expect(updated.amount).toBe(60);
	yield* lines.updateVoid({ ...updated, name: "Final" });
	expect((yield* lines.findById(consulting.id)).name).toBe("Final");
	yield* lines.delete(consulting.id);
	yield* lines.delete(consulting.id);
	expect(yield* lines.findMany({ where: { id: consulting.id } })).toEqual([]);
});
