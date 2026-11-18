import { Context, Effect, Schema } from "effect";

export const SyncToken = Schema.Struct({
	client: Schema.String.check(Schema.isPattern(/^[\w-]{1,64}$/u)),
	id: Schema.Int.check(Schema.isGreaterThan(0)),
});
export type SyncToken = typeof SyncToken.Type;

export const SyncDelivery = Context.Reference<(token: SyncToken) => Effect.Effect<void>>("@shivaedev/changes/SyncDelivery", {
	defaultValue: () => () => Effect.void,
});
