import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "../src/index.ts";

class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
	amount: Schema.NumberFromString.check(Schema.isFinite()),
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}

const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table invoice_line (id integer primary key, name text not null, amount text not null, note text)`;
	const lines = yield* makeRepository(InvoiceLine, {
		idColumn: "id",
		spanPrefix: "InvoiceLine",
		tableName: "invoice_line",
	});
	return { lines, sql };
});

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(effect.pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))));

test("model variants derive CRUD while field codecs drive filters and selections", async () => {
	await run(
		Effect.gen(function* () {
			const { lines, sql } = yield* setup;
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
		}),
	);
});

test("repository writes participate in the caller's native transaction", async () => {
	await run(
		Effect.gen(function* () {
			const { lines, sql } = yield* setup;
			const result = yield* sql
				.withTransaction(
					Effect.gen(function* () {
						yield* lines.insert({ amount: 1, name: "Rollback", note: null });
						expect(yield* lines.findMany({ select: ["name"] })).toEqual([{ name: "Rollback" }]);
						return yield* Effect.fail("cancelled");
					}),
				)
				.pipe(Effect.result);
			expect(result._tag).toBe("Failure");
			expect(yield* lines.findMany()).toEqual([]);
		}),
	);
});

test("query decoding and invalid limits remain typed failures", async () => {
	await run(
		Effect.gen(function* () {
			const { lines, sql } = yield* setup;
			yield* sql`insert into invoice_line (name, amount) values ('Imported', 'not-a-number')`;
			const badRow = yield* lines.findMany().pipe(Effect.flip);
			expect(badRow._tag).toBe("SchemaError");
			const badLimit = yield* lines.findMany({ limit: -1 }).pipe(Effect.flip);
			expect(badLimit._tag).toBe("SchemaError");
			yield* sql`drop table invoice_line`;
			const missingTable = yield* lines.findMany().pipe(Effect.flip);
			expect(missingTable._tag).toBe("SqlError");
		}),
	);
});

test("undefined filter values leave that field unconstrained", async () => {
	await run(
		Effect.gen(function* () {
			const { lines } = yield* setup;
			yield* lines.insert({ amount: 52, name: "Consulting", note: null });
			yield* lines.insert({ amount: 57, name: "Hosting", note: "annual" });
			const name: string | undefined = undefined;
			expect(
				yield* lines.findMany({
					select: ["name"],
					where: { amount: 57, name },
				}),
			).toEqual([{ name: "Hosting" }]);
		}),
	);
});

test("unknown runtime field names fail as SchemaError", async () => {
	const unknownField = (): "name" => JSON.parse('"missing"');
	await run(
		Effect.gen(function* () {
			const { lines } = yield* setup;
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
		}),
	);
});

class Prefix extends Context.Service<Prefix, string>()("test/Prefix") {}
const Prefixed = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformOrFail((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformOrFail((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
class Label extends Model.Class<Label>("Label")({
	id: Schema.Number,
	name: Prefixed,
}) {}

test("field codec services remain available when filtering and decoding selected rows", async () => {
	const program = Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table label (id integer primary key, name text not null)`;
		const labels = yield* makeRepository(Label, {
			idColumn: "id",
			spanPrefix: "Label",
			tableName: "label",
		});
		const query = labels.findMany({
			select: ["name"],
			where: { name: "Consulting" },
		});
		expectTypeOf<Effect.Services<typeof query>>().toEqualTypeOf<Prefix>();
		yield* labels.insert({ id: 1, name: "Consulting" });
		expect(yield* sql`select name from label`).toEqual([{ name: "db:Consulting" }]);
		expect(yield* query).toEqual([{ name: "Consulting" }]);
	}).pipe(Effect.provideService(Prefix, "db:"));
	await run(program);
});
