import { Schema } from "effect";

const TextContentPart = Schema.Struct({
	text: Schema.String,
	textElements: Schema.optional(Schema.Array(Schema.Unknown)),
	type: Schema.Literal("text"),
}).pipe(Schema.encodeKeys({ textElements: "text_elements" }));

const ImageContentPart = Schema.Struct({
	detail: Schema.optional(Schema.NullOr(Schema.String)),
	type: Schema.Literal("image"),
	url: Schema.String,
});

const LocalImageContentPart = Schema.Struct({
	detail: Schema.optional(Schema.NullOr(Schema.String)),
	path: Schema.String,
	type: Schema.Literal("localImage"),
});

const UserContentPart = Schema.Union([TextContentPart, ImageContentPart, LocalImageContentPart]);

export const UserMessageItem = Schema.Struct({
	clientId: Schema.optional(Schema.NullOr(Schema.String)),
	content: Schema.Array(UserContentPart),
	id: Schema.String,
	type: Schema.Literal("userMessage"),
});
