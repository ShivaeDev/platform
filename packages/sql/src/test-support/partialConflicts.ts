import { Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { CurrentTransformer } from "effect/sql/Statement";
import { makeRepository } from "#repository.ts";

export class PartialRow extends Model.Class<PartialRow>("PartialRow")({
	a: Schema.String,
	b: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	kind: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transform((value: string) => value.toUpperCase()),
			encode: SchemaGetter.transform((value: string) => value.toLowerCase()),
		}),
	),
	value: Schema.Number,
}) {}

export const partialConflicts = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `partial_conflicts_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	yield* sql`create table ${sql(tableName)} (
		id integer generated always as identity primary key,
		a text not null, b text not null, kind text not null, value integer not null
	)`;
	yield* sql`create unique index ${sql(`${tableName}_key`)} on ${sql(tableName)} (a, b) where kind = 'x'`;
	const options = { conflictColumns: ["a", "b"], idColumn: "id", spanPrefix: "PartialRow", tableName } as const;
	const rows = yield* makeRepository(PartialRow, { ...options, conflictWhere: { kind: "X" } });
	const statements: (readonly [string, readonly unknown[]])[] = [];
	function observe<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return effect.pipe(
			Effect.provideService(CurrentTransformer, (statement) =>
				Effect.sync(() => {
					statements.push(statement.compile());
					return statement;
				}),
			),
		);
	}
	return { observe, options, rows, statements };
});
