import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { makeRepository } from "#repository.ts";
export class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
	amount: Schema.NumberFromString.check(Schema.isFinite()),
	id: Model.Field({
		json: Schema.Number,
		select: Schema.Number,
		update: Schema.Number,
	}),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}
export const setup = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table invoice_line (id integer primary key, name text not null, amount text not null, note text)`;
	const lines = yield* makeRepository(InvoiceLine, {
		idColumn: "id",
		spanPrefix: "InvoiceLine",
		tableName: "invoice_line",
	});
	return { lines, sql };
});
export class Prefix extends Context.Service<Prefix, string>()("test/Prefix") {}
export const Prefixed = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(Prefix, (prefix) => prefix + value)),
	}),
);
export class Label extends Model.Class<Label>("Label")({
	id: Schema.Number,
	name: Prefixed,
}) {}

export const labelsWithPrefix = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table label (id integer primary key, name text not null)`;
	return yield* makeRepository(Label, { idColumn: "id", spanPrefix: "Label", tableName: "label" });
});
