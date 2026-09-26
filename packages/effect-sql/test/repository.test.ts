import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/unstable/schema";
import { SqlClient } from "effect/unstable/sql";
import { expect, expectTypeOf, test } from "vitest";
import { makeRepository } from "../src/index.ts";

class Food extends Model.Class<Food>("Food")({
	id: Model.Field({
		select: Schema.Number,
		update: Schema.Number,
		json: Schema.Number,
	}),
	name: Schema.String,
	calories: Schema.NumberFromString.check(Schema.isFinite()),
	note: Schema.NullOr(Schema.String),
}) {}

const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table food (id integer primary key, name text not null, calories text not null, note text)`;
	const foods = yield* makeRepository(Food, {
		tableName: "food",
		idColumn: "id",
		spanPrefix: "Food",
	});
	return { sql, foods };
});

const run = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
	Effect.runPromise(effect.pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))));

test("model variants derive CRUD while field codecs drive filters and selections", async () => {
	await run(
		Effect.gen(function* () {
			const { foods, sql } = yield* setup;
			const apple = yield* foods.insert({
				name: "Apple",
				calories: 52,
				note: null,
			});
			expect(apple).toBeInstanceOf(Food);
			expect(apple.id).toBe(1);
			expect(apple.calories).toBe(52);
			const stored = yield* sql`select calories from food`;
			expect(stored).toEqual([{ calories: "52" }]);
			yield* foods.insert({ name: "Pear", calories: 57, note: "ripe" });
			const selected = yield* foods.findMany({
				where: { calories: 52, note: null },
				select: ["name", "calories"],
			});
			expectTypeOf(selected).toEqualTypeOf<Array<{ readonly name: string; readonly calories: number }>>();
			expect(selected).toEqual([{ name: "Apple", calories: 52 }]);
			expect(
				yield* foods.findMany({
					select: ["name"],
					orderBy: { field: "name", direction: "desc" },
					limit: 1,
				}),
			).toEqual([{ name: "Pear" }]);
			expect(yield* foods.findMany({ limit: 0 })).toEqual([]);
			yield* foods.update({
				id: apple.id,
				name: "Red apple",
				calories: 55,
				note: null,
			});
			expect((yield* foods.findById(apple.id)).name).toBe("Red apple");
			yield* foods.delete(apple.id);
			expect(yield* foods.findMany({ where: { id: apple.id } })).toEqual([]);
		}),
	);
});

test("repository writes participate in the caller's native transaction", async () => {
	await run(
		Effect.gen(function* () {
			const { foods, sql } = yield* setup;
			const result = yield* sql
				.withTransaction(
					Effect.gen(function* () {
						yield* foods.insert({ name: "Rollback", calories: 1, note: null });
						expect(yield* foods.findMany({ select: ["name"] })).toEqual([{ name: "Rollback" }]);
						return yield* Effect.fail("cancelled");
					}),
				)
				.pipe(Effect.result);
			expect(result._tag).toBe("Failure");
			expect(yield* foods.findMany()).toEqual([]);
		}),
	);
});

test("query decoding and invalid limits remain typed failures", async () => {
	await run(
		Effect.gen(function* () {
			const { foods, sql } = yield* setup;
			yield* sql`insert into food (name, calories) values ('Imported', 'not-a-number')`;
			const badRow = yield* foods.findMany().pipe(Effect.flip);
			expect(badRow._tag).toBe("SchemaError");
			const badLimit = yield* foods.findMany({ limit: -1 }).pipe(Effect.flip);
			expect(badLimit._tag).toBe("SchemaError");
			yield* sql`drop table food`;
			const missingTable = yield* foods.findMany().pipe(Effect.flip);
			expect(missingTable._tag).toBe("SqlError");
		}),
	);
});

test("undefined filter values leave that field unconstrained", async () => {
	await run(
		Effect.gen(function* () {
			const { foods } = yield* setup;
			yield* foods.insert({ name: "Apple", calories: 52, note: null });
			yield* foods.insert({ name: "Pear", calories: 57, note: "ripe" });
			const name: string | undefined = undefined;
			expect(
				yield* foods.findMany({
					where: { name, calories: 57 },
					select: ["name"],
				}),
			).toEqual([{ name: "Pear" }]);
		}),
	);
});

test("unknown runtime field names fail as SchemaError", async () => {
	const unknownField = (): "name" => JSON.parse('"missing"');
	await run(
		Effect.gen(function* () {
			const { foods } = yield* setup;
			const failures = yield* Effect.forEach(
				[
					foods.findMany({ select: [unknownField()] }),
					foods.findMany({ where: { [unknownField()]: "Apple" } }),
					foods.findMany({
						orderBy: { field: unknownField(), direction: "asc" },
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
			tableName: "label",
			idColumn: "id",
			spanPrefix: "Label",
		});
		const query = labels.findMany({
			where: { name: "Apple" },
			select: ["name"],
		});
		expectTypeOf<Effect.Services<typeof query>>().toEqualTypeOf<Prefix>();
		yield* labels.insert({ id: 1, name: "Apple" });
		expect(yield* sql`select name from label`).toEqual([{ name: "db:Apple" }]);
		expect(yield* query).toEqual([{ name: "Apple" }]);
	}).pipe(Effect.provideService(Prefix, "db:"));
	await run(program);
});
