import { Schema } from "effect";

export const Email = Schema.Struct({
	from: Schema.String,
	html: Schema.String,
	subject: Schema.String,
	text: Schema.String,
	to: Schema.String,
});
export type Email = typeof Email.Type;
