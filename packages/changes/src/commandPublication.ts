import { type Cause, Context, Data, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";

export class CommandPublicationError extends Data.TaggedError("CommandPublicationError")<{
	readonly cause: Cause.Cause<unknown>;
}> {}

export interface CommandPublisher {
	readonly publish: (keys: readonly unknown[]) => Effect.Effect<void, CommandPublicationError, Reactivity.Reactivity>;
	readonly recover: Effect.Effect<void, CommandPublicationError>;
}

export const CommandPublication = Context.Reference<CommandPublisher>("@shivaedev/changes/CommandPublication", {
	defaultValue: () => ({
		publish: (keys) => Reactivity.invalidate(keys).pipe(Effect.catchCause((cause) => Effect.fail(new CommandPublicationError({ cause })))),
		recover: Effect.void,
	}),
});
