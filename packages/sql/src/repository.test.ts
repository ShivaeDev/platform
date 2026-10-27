import { Effect } from "effect";
import { expect, expectTypeOf } from "vitest";
import { InvoiceLine, Prefix } from "#test/sqliteRepository.ts";
import { sqlite } from "#test/sqlStory.ts";
import { hasLabelsWithPrefix, hasSqliteInvoiceLines } from "#test/sqlTraits.ts";
import { transaction } from "#test/transaction.ts";

sqlite.it("model variants derive CRUD while field codecs drive filters and selections", [hasSqliteInvoiceLines()], function* ({ sqliteLines, sql }) {
	const { lines } = sqliteLines();
	const consulting = yield* lines.insert({
		amount: 52,
		name: "Consulting",
		note: null,
	});
	expect(consulting).toBeInstanceOf(InvoiceLine);
	expect(consulting.id).toBe(1);
	expect(consulting.amount).toBe(52);
	const stored = yield* sql`select amount from invoice_line`;
	expect(stored).toEqual([{ amount: "52" }]);
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
	expect(yield* lines.findMany({ limit: 0 })).toEqual([]);
	yield* lines.update({
		amount: 55,
		id: consulting.id,
		name: "Onsite consulting",
		note: null,
	});
	expect((yield* lines.findById(consulting.id)).name).toBe("Onsite consulting");
	yield* lines.delete(consulting.id);
	expect(yield* lines.findMany({ where: { id: consulting.id } })).toEqual([]);
});

sqlite.it("repository writes participate in the caller's native transaction", [hasSqliteInvoiceLines()], function* ({ sqliteLines }) {
	const { lines } = sqliteLines();
	const result = yield* transaction(
		Effect.gen(function* () {
			yield* lines.insert({ amount: 1, name: "Rollback", note: null });
			expect(yield* lines.findMany({ select: ["name"] })).toEqual([{ name: "Rollback" }]);
			return yield* Effect.fail("cancelled");
		}),
	).pipe(Effect.result);
	expect(result._tag).toBe("Failure");
	expect(yield* lines.findMany()).toEqual([]);
});

sqlite.it("query decoding and invalid limits remain typed failures", [hasSqliteInvoiceLines()], function* ({ sqliteLines, sql }) {
	const { lines } = sqliteLines();
	yield* sql`insert into invoice_line (name, amount) values ('Imported', 'not-a-number')`;
	const badRow = yield* lines.findMany().pipe(Effect.flip);
	expect(badRow._tag).toBe("SchemaError");
	const badLimit = yield* lines.findMany({ limit: -1 }).pipe(Effect.flip);
	expect(badLimit._tag).toBe("SchemaError");
	yield* sql`drop table invoice_line`;
	const missingTable = yield* lines.findMany().pipe(Effect.flip);
	expect(missingTable._tag).toBe("SqlError");
});

sqlite.it("undefined filter values leave that field unconstrained", [hasSqliteInvoiceLines()], function* ({ sqliteLines }) {
	const { lines } = sqliteLines();
	yield* lines.insert({ amount: 52, name: "Consulting", note: null });
	yield* lines.insert({ amount: 57, name: "Hosting", note: "annual" });
	const name: string | undefined = undefined;
	expect(
		yield* lines.findMany({
			select: ["name"],
			where: { amount: 57, name },
		}),
	).toEqual([{ name: "Hosting" }]);
});

sqlite.it("unknown runtime field names fail as SchemaError", [hasSqliteInvoiceLines()], function* ({ sqliteLines }) {
	function unknownField(): "name" {
		return JSON.parse('"missing"');
	}

	const { lines } = sqliteLines();
	const failures = yield* Effect.forEach(
		[
			lines.findMany({ select: [unknownField()] }),
			lines.findMany({ where: { [unknownField()]: "Consulting" } }),
			lines.findMany({
				orderBy: { direction: "asc", field: unknownField() },
			}),
		],
		(query) => Effect.flip(query),
	);
	expect(failures.map((failure) => failure._tag)).toEqual(["SchemaError", "SchemaError", "SchemaError"]);
	expect(failures[0]?.message).toContain("missing");
});

sqlite.it(
	"field codec services remain available when filtering and decoding selected rows",
	[hasLabelsWithPrefix()],
	function* ({ sql, labels: getLabels }) {
		const program = Effect.gen(function* () {
			const labels = getLabels();
			const query = labels.findMany({
				select: ["name"],
				where: { name: "Consulting" },
			});
			expectTypeOf<Effect.Services<typeof query>>().toEqualTypeOf<Prefix>();
			yield* labels.insert({ id: 1, name: "Consulting" });
			expect(yield* sql`select name from label`).toEqual([{ name: "db:Consulting" }]);
			expect(yield* query).toEqual([{ name: "Consulting" }]);
		}).pipe(Effect.provideService(Prefix, "db:"));
		yield* program;
	},
);
