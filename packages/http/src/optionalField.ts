import { Effect, Option, Schema } from "effect";

export function optionalField<TSchema extends Schema.Constraint>(schema: TSchema) {
	return Schema.catchDecoding<Schema.optionalKey<TSchema>>(() => Effect.succeed(Option.none()))(Schema.optionalKey(schema));
}
