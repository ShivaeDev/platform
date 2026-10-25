import { Schema } from "effect";
import { DispatchRequest } from "#DispatchRequest.ts";
import { State } from "#host/waitOutcome.ts";

export const watchRecordFields = {
	result: Schema.optional(Schema.Struct({ head: Schema.String, pr: Schema.optional(Schema.String) })),
	stageEnteredAt: Schema.optional(Schema.Number),
};

export const WatchState = Schema.Struct({
	...State.fields,
	...watchRecordFields,
	answerFailure: Schema.optional(Schema.Struct({ error: Schema.String, id: Schema.String })),
	dispatch: Schema.optional(DispatchRequest),
	progressAt: Schema.optional(Schema.Number),
});
export type WatchState = typeof WatchState.Type;

export const WatchSnapshot = Schema.Struct({
	epoch: Schema.String,
	states: Schema.optional(Schema.Array(WatchState)),
});
