import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { mapSqlError } from "#mapSqlError.ts";
import { makeRepository } from "#repository.ts";

export class Item extends Model.Class<Item>("ConstraintItem")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	parentId: Schema.optional(Schema.NullOr(Schema.Number)),
	quantity: Schema.Number,
}) {}
export class NameTaken extends Schema.TaggedError<NameTaken>()("NameTaken", {}) {}
export class ParentMissing extends Schema.TaggedError<ParentMissing>()("ParentMissing", {}) {}
export class InvalidQuantity extends Schema.TaggedError<InvalidQuantity>()("InvalidQuantity", {}) {}
export class NameTooLong extends Schema.TaggedError<NameTooLong>()("NameTooLong", {}) {}
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {}) {}

export const constrainedItems = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const tableName = `constraints_${crypto.randomUUID().replaceAll("-", "")}`;
	yield* Effect.addFinalizer(() => sql`drop table if exists ${sql(tableName)}`.pipe(Effect.orDie));
	const unique = `${tableName}_name_key`;
	const foreign = `${tableName}_parent_fkey`;
	const check = `${tableName}_quantity_check`;
	const long = `${tableName}_name_${"ä".repeat(8)}_length_check`;
	yield* sql`create table ${sql(tableName)} (
		id integer generated always as identity primary key,
		name text not null,
		"parentId" integer constraint ${sql(foreign)} references ${sql(tableName)} (id),
		quantity integer not null constraint ${sql(check)} check (quantity >= 0),
		constraint ${sql(unique)} unique (name),
		constraint ${sql(long)} check (length(name) <= 40)
	)`;
	const items = yield* makeRepository(Item, { idColumn: "id", spanPrefix: "ConstraintItem", tableName });
	const onSqlError = mapSqlError({
		constraints: {
			[check]: () => new InvalidQuantity(),
			[foreign]: () => new ParentMissing(),
			[long]: () => new NameTooLong(),
			[unique]: () => new NameTaken(),
		},
		fallback: () => new StorageUnavailable(),
	});
	return { items, onSqlError, tableName };
});
