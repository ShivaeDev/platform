import { Effect, type Schema, SchemaParser } from "effect";
import { messageAtPath, messagesByField } from "#messages.ts";
import { type Encoded, type Fields, Invalid, type Name, type Snapshot } from "#shape.ts";

export function validation<TFields extends Fields>(
	schema: Schema.Struct<TFields>,
	requiredMessages: Readonly<Partial<Record<Name<TFields>, string>>> | undefined,
) {
	const decode = SchemaParser.decodeUnknownEffect(schema, { errors: "all" });
	return {
		decode,
		snapshot: (encoded: Encoded<TFields>) =>
			decode(encoded).pipe(
				Effect.map((decoded): Snapshot<TFields> => ({ decoded, encoded })),
				Effect.mapError((issue) => new Invalid({ formMessage: messageAtPath(issue, []), messages: messagesByField(issue, requiredMessages) })),
			),
	};
}
