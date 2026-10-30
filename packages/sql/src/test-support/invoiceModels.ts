import { Context, Effect, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";

export class InvoiceLine extends Model.Class<InvoiceLine>("InvoiceLine")({
	amount: Schema.NumberFromString.check(Schema.isFinite()),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}

export class LabelPrefix extends Context.Service<LabelPrefix, string>()("test/LabelPrefix") {}

const Prefixed = Schema.String.pipe(
	Schema.decodeTo(Schema.String, {
		decode: SchemaGetter.transformEffect((value: string) => Effect.map(LabelPrefix, (prefix) => value.slice(prefix.length))),
		encode: SchemaGetter.transformEffect((value: string) => Effect.map(LabelPrefix, (prefix) => prefix + value)),
	}),
);

export class Label extends Model.Class<Label>("Label")({
	id: Schema.Number,
	name: Prefixed,
}) {}
