import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";

export class KeyPrefix extends Context.Service<KeyPrefix, string>()("test/KeyPrefix") {}

export const PrefixedKey = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(KeyPrefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(KeyPrefix, (prefix) => prefix + value)),
	}),
);

export class Account extends Model.Class<Account>("Account")({
	amount: Schema.NumberFromString,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	email: Schema.String,
	externalKey: PrefixedKey,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.optional(Schema.NullOr(Schema.String)),
	origin: Model.Field({ insert: Schema.String, select: Schema.String }),
}) {}

export class Reading extends Model.Class<Reading>("Reading")({
	amount: Schema.NumberFromString,
	label: Schema.String,
	sequence: Schema.NumberFromString,
	source: Schema.String,
}) {}
