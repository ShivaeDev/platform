import { Schema } from "effect";

export const Raw = Schema.Struct({ kind: Schema.String, payload: Schema.String, source: Schema.String });
export const Origin = Schema.Struct({ node: Schema.optional(Schema.String), parentNode: Schema.optional(Schema.String), spawnedBy: Schema.String });
export const attribution = { origin: Schema.optional(Origin), raw: Schema.optional(Raw) };

export const Usage = Schema.Struct({
	type: Schema.Literal("usage"),
	...attribution,
	cacheReadTokens: Schema.optional(Schema.Number),
	cacheWriteTokens: Schema.optional(Schema.Number),
	inputTokens: Schema.optional(Schema.Number),
	model: Schema.optional(Schema.String),
	outputTokens: Schema.optional(Schema.Number),
	scope: Schema.Literals(["delta", "cumulative"]),
	unit: Schema.Literals(["run", "turn", "session"]),
});
export const Cost = Schema.Struct({
	type: Schema.Literal("cost"),
	...attribution,
	amount: Schema.Number,
	currency: Schema.String,
	model: Schema.optional(Schema.String),
	scope: Schema.Literals(["delta", "cumulative"]),
	source: Schema.Literals(["provider", "estimated"]),
	unit: Schema.Literals(["run", "turn", "session"]),
});
export const Gap = Schema.Struct({
	type: Schema.Literal("gap"),
	...attribution,
	detail: Schema.String,
	kind: Schema.String,
});
export const ModelChoice = Schema.Struct({
	defaultEffort: Schema.optional(Schema.String),
	efforts: Schema.Array(Schema.String),
	id: Schema.String,
	isDefault: Schema.Boolean,
	name: Schema.String,
});
export type ModelChoice = typeof ModelChoice.Type;
