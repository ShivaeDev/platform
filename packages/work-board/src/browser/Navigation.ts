import { Schema } from "effect";

export const Navigation = Schema.Struct({
	counts: Schema.Struct({ goals: Schema.Number, library: Schema.Number, now: Schema.Number, system: Schema.Number }),
	home: Schema.optional(Schema.Struct({ file: Schema.String, identity: Schema.optional(Schema.String), title: Schema.optional(Schema.String) })),
	inboxCount: Schema.NullOr(Schema.Number),
});
export type Navigation = typeof Navigation.Type;
