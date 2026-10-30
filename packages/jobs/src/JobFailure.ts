import { Effect, Schema, SchemaGetter } from "effect";
import { isSensitiveKey, redactText } from "@shivaedev/errors/sensitive.ts";

const redactMessage = SchemaGetter.transform((message: string) => redactText(message, isSensitiveKey));
export const JobFailure = Schema.Struct({
	_tag: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed("Error"))),
	message: Schema.String.pipe(Schema.decodeTo(Schema.String, { decode: redactMessage, encode: redactMessage })),
});
export type JobFailure = typeof JobFailure.Type;
