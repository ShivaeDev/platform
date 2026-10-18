import { Schema } from "effect";

export const AttemptProgress = Schema.Struct({
	briefSteers: Schema.optional(
		Schema.Array(
			Schema.Struct({
				error: Schema.optional(Schema.String),
				requestedAt: Schema.Number,
				revision: Schema.String,
				steeredAt: Schema.optional(Schema.Number),
			}),
		),
	),
	progress: Schema.optional(Schema.Struct({ at: Schema.Number, signature: Schema.String })),
	stallRecovery: Schema.optional(
		Schema.Struct({
			count: Schema.Number,
			interruptedAt: Schema.optional(Schema.Number),
			interruptRequestedAt: Schema.optional(Schema.Number),
			lastActionAt: Schema.Number,
			steeredAt: Schema.optional(Schema.Number),
		}),
	),
});
