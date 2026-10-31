import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { makeRepository } from "#repository.ts";
import { type TupleColumnType, tupleIn } from "#tupleIn.ts";
import { onPostgres } from "./engines.ts";

class EncodedTupleRow extends Model.Class<EncodedTupleRow>("EncodedTupleColumnRow")({ id: Schema.Int, value: Schema.NumberFromString }) {}

class TupleRow extends Model.Class<TupleRow>("TupleColumnRow")({ id: Schema.Int, value: Schema.Unknown }) {}

const create = Effect.fnUntraced(function* () {
	const sql = yield* SqlClient.SqlClient;
	const table = `tuple_column_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => Effect.orDie(sql`drop table if exists ${sql(table)}`));
	const repository = yield* makeRepository(TupleRow, { idColumn: "id", spanPrefix: "TupleColumn", tableName: table });
	const encoded = yield* makeRepository(EncodedTupleRow, { idColumn: "id", spanPrefix: "EncodedTupleColumn", tableName: table });
	return { encoded, repository, sql, table };
});

export const tupleColumns = storyKit({
	...onPostgres,
	create,
	name: "PostgreSQL tuple column types",
	stages: ["rows"],
	verbs: ({ encoded, repository, sql }, story) => {
		function inTimezone<A, E, R>(effect: Effect.Effect<A, E, R>, timeZone: string | undefined) {
			return timeZone === undefined
				? effect
				: sql.withTransaction(sql`select set_config('TimeZone', ${timeZone}, true)`.pipe(Effect.andThen(effect)));
		}
		return {
			findEncodedTuples: (type: TupleColumnType, values: readonly (readonly [number, number])[]) => {
				story.tell("the tuples are encoded to numeric strings before filtering the numeric column");
				return encoded.findMany({ select: ["id"], where: tupleIn(EncodedTupleRow, ["id", "value"], values, { id: "int4", value: type }) });
			},
			findEqual: (id: number, value: unknown, timeZone?: string) => {
				story.tell("the row is read by plain equality on both fields");
				return inTimezone(repository.findMany({ select: ["id"], where: { id, value } }), timeZone);
			},
			findTuples: (type: TupleColumnType, values: readonly (readonly [number, unknown])[], timeZone?: string) => {
				story.tell(`the rows are read by tuples with ${type} values`);
				return inTimezone(
					repository.findMany({
						orderBy: { direction: "asc", field: "id" },
						select: ["id"],
						where: tupleIn(TupleRow, ["id", "value"], values, { id: "int4", value: type }),
					}),
					timeZone,
				);
			},
		};
	},
});

export function storedColumn(type: TupleColumnType, first: unknown, second: unknown) {
	return tupleColumns.trait("rows", `rows 1 and 3 share one ${type} value, row 2 holds a different value`, function* ({ repository, sql, table }) {
		yield* sql`create table ${sql(table)} (id integer primary key, value ${sql.literal(type)})`;
		yield* repository.insertMany([
			{ id: 1, value: first },
			{ id: 2, value: second },
			{ id: 3, value: first },
		]);
	});
}
