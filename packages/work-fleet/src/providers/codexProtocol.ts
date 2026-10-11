import { Schema } from "effect";

const Echo = Schema.optional(Schema.NullOr(Schema.String));
export const ThreadResponse = Schema.Struct({
	model: Echo,
	reasoningEffort: Echo,
	serviceTier: Echo,
	thread: Schema.Struct({ id: Schema.String }),
});
export const TurnResponse = Schema.Struct({ turn: Schema.Struct({ id: Schema.String }) });
export const Item = Schema.Struct({
	clientId: Schema.optional(Schema.NullOr(Schema.String)),
	id: Schema.String,
	phase: Schema.optional(Schema.NullOr(Schema.String)),
	text: Schema.optional(Schema.String),
	type: Schema.String,
});
export const Turn = Schema.Struct({
	error: Schema.optional(Schema.NullOr(Schema.Struct({ codexErrorInfo: Schema.optional(Schema.Unknown), message: Schema.String }))),
	id: Schema.String,
	items: Schema.Array(Item),
	status: Schema.Literals(["inProgress", "completed", "interrupted", "failed"]),
});
export const TurnsResponse = Schema.Struct({ data: Schema.Array(Turn), nextCursor: Schema.NullOr(Schema.String) });
export const ItemsResponse = Schema.Struct({ data: Schema.Array(Schema.Struct({ item: Item })), nextCursor: Schema.NullOr(Schema.String) });
export const Envelope = Schema.Struct({
	error: Schema.optional(Schema.Unknown),
	id: Schema.optional(Schema.Union([Schema.String, Schema.Number])),
	method: Schema.optional(Schema.String),
	result: Schema.optional(Schema.Unknown),
});
