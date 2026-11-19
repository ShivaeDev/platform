import { Schema } from "effect";
import { Model } from "effect/schema";

const STORED = "@shivaedev/sql/serverOnlyStored";

// A select variant that refuses every encode keeps a row that reaches the RPC encoder, through a cast or a hand-written
// contract, from sending the value; the write variants still encode the plain value for the column.
export function serverOnly<TValue extends Schema.Top>(value: TValue) {
	const Stored = Schema.RedactedFromValue(value);
	return Model.Field({
		insert: Stored,
		select: Schema.RedactedFromValue(value, { disallowEncode: true }).annotate({ [STORED]: Stored }),
		update: Stored,
	});
}

// The schema that encodes a server-only field's value for a statement, or undefined for any other field.
export function serverOnlyStored(field: Schema.Constraint): Schema.Constraint | undefined {
	const stored = Schema.resolveAnnotations(field)?.[STORED];
	return Schema.isSchema(stored) ? stored : undefined;
}
