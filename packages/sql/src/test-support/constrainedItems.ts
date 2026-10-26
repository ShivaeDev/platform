import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import type { SqlError } from "effect/sql/SqlError";
import { makeRepository } from "#repository.ts";
export class Item extends Model.Class<Item>("ConstraintItem")({
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	quantity: Schema.Number,
}) {}
export class NameTaken extends Schema.TaggedError<NameTaken>()("NameTaken", {}) {}
export function namedUniqueViolation(unique: string) {
	return (error: SqlError): Effect.Effect<never, NameTaken | SqlError> =>
		error.reason._tag === "UniqueViolation" && error.reason.constraint === unique ? Effect.fail(new NameTaken()) : Effect.fail(error);
}
export const constrainedItems = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `constraints_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	const unique = `${tableName}_name_key`;
	yield* sql`create table ${sql(tableName)} (
    id integer generated always as identity primary key,
    name text not null,
    quantity integer not null check (quantity >= 0),
    constraint ${sql(unique)} unique (name)
   )`;
	const items = yield* makeRepository(Item, {
		idColumn: "id",
		spanPrefix: "ConstraintItem",
		tableName,
	});
	return { items, unique };
});
