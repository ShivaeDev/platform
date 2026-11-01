import { Schema } from "effect";

export const Navigation = Schema.Struct({
	counts: Schema.Struct({
		goals: Schema.NullOr(Schema.Number),
		library: Schema.NullOr(Schema.Number),
		now: Schema.NullOr(Schema.Number),
		system: Schema.Number,
	}),
	home: Schema.optional(Schema.Struct({ file: Schema.String, identity: Schema.optional(Schema.String), title: Schema.optional(Schema.String) })),
	inboxCount: Schema.NullOr(Schema.Number),
});
export type Navigation = typeof Navigation.Type;
