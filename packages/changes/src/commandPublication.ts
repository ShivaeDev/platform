import { type Cause, Context, Data, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SyncDelivery, type SyncToken } from "#syncToken.ts";

export class CommandPublicationError extends Data.TaggedError("CommandPublicationError")<{
	readonly cause: Cause.Cause<unknown>;
}> {}

export interface CommandPublisher {
	readonly publish: (keys: readonly unknown[], sync?: SyncToken) => Effect.Effect<void, CommandPublicationError, Reactivity.Reactivity>;
	readonly recover: Effect.Effect<void, CommandPublicationError>;
}

export const CommandPublication = Context.Reference<CommandPublisher>("@shivaedev/changes/CommandPublication", {
	defaultValue: () => ({
		publish: (keys, sync) =>
			Reactivity.invalidate(keys).pipe(
				Effect.andThen(sync === undefined ? Effect.void : Effect.flatMap(SyncDelivery, (deliver) => deliver(sync))),
				Effect.catchCause((cause) => Effect.fail(new CommandPublicationError({ cause }))),
			),
		recover: Effect.void,
	}),
});
